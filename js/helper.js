$(document).ready(function()
{
	_.templateSettings.variable = "data";
	jQuery.fn.outerHTML = function(s) {
		return (s)
		? this.before(s).remove()
		: jQuery("<p>").append(this.eq(0).clone()).html();
	};
	
	addCustomValidators();
	initializeValidation();
	
	initialElementSetup();
	
	MonthModule = Backbone.View.extend({
		initialize: function(params, year, month, meta) {
			this.year = year;
			this.month = month;
			this.meta = meta;
			this.data = {
				year: year,
				month: month,
				shortYear: year.substr(2, 3),
				shortMonth: month.substr(0, 3)
			};
			this.calculate();
		},
		calculate: function() {
			this.data.total_expenses = this.meta.get('total_expenses');
			this.data.total_income = this.meta.get('total_income');
			this.data.entries = sortByIncomeThenAmount(getEntriesArrayForYearMonth(this.year, this.month));
			this.data.end_balance = this.meta.get('est_end_balance');
			this.data.meta = this.meta;
			var currentStartBalance = this.meta.get('start_balance');
			if(currentStartBalance != undefined)
				this.data.start_balance = currentStartBalance;
			else
				this.data.start_balance = this.meta.get('est_start_balance');
			this.data.discrepancy = this.meta.get('discrepancy');
		},
		events: {
			"click #addButton": "addMonthOneTime",
			"click #startBalanceLabel": "showStartBalanceInput",
			"submit #startBalanceForm": "updateStartBalance",
			"click #editButton": "editEntry",
			"click #deleteButton": "deleteEntry"
		},
		editEntry: function(event) {
			var entryName = ($(event.target).parents(".entry_data")).attr('name');
			editEntry(this.data.entries[entryName], this.year, this.month);
		},
		deleteEntry: function(event) {
			var entryName = ($(event.target).parents(".entry_data")).attr('name');
			deleteEntry(this.data.entries[entryName], this.year, this.month);
		},
		updateStartBalance: function(event) {
			var $input = $(event.target).find('#startBalanceInput');
			var val = $input.val();
			if(val[0] == '$')
				val = val.substr(1, val.length);
			var new_start_bal = parseInt(val);
			
			var m = monthsMeta.get(this.year + ":" + this.month);
			if(m == undefined)
			{
				m = new Backbone.Model();
				m.set('id', this.year + ":" + this.month);
				monthsMeta.add(m);
			}
			m.set('start_balance', new_start_bal);
			refreshEntries();
			return false;
		},
		showStartBalanceInput: function(event) {
			var $label = $(event.target);
			var $input = $label.siblings('#startBalanceInput');
			$('.start_balance_input').hide();
			$('.start_balance_label').show();
			$input.show();
			$input.val($label.html().replace('$', ''));
			$input.focus();
			$input.select();
			$label.hide();
		},
		addMonthOneTime: function(event) {
			showEntryDialogUnderYearMonth($(event.target), this.year, this.month);
		},
		render: function() {
			var html = render('month_module', this.data);
			
			$(this.el).html(html);
			return this;
		}
	});
	
	$('.dirtyfilter').on("change", function() {
		dirtyFilter = true;
	});
	
	retrieveParseRefreshEntries();
});

function sortByIncomeThenAmount(models)
{
	// Group by expense and income
	var groups = _.groupBy(models, function(value) {return value.get('amount') < 0;});
	// Sort both expenses and income by amount
	for(var key in groups)
	{
		groups[key] = _.sortBy(groups[key], function(value) {
			return -Math.abs(value.get('amount'));
		});
	}
	
	// Populate our new list of entries in the order of Income followed by Expenses
	var arr = [];
	if(groups['false'] != undefined)
		arr = arr.concat(groups['false']);
	if(groups['true'] != undefined)
		arr = arr.concat(groups['true']);
	return arr;
}

function render(tmpl_name, tmpl_data) {
    if ( !render.tmpl_cache ) { 
        render.tmpl_cache = {};
    }

    if ( ! render.tmpl_cache[tmpl_name] ) {
        var tmpl_dir = '/underscore_templates';
        var tmpl_url = tmpl_dir + '/' + tmpl_name + '.html';

        var tmpl_string;
        $.ajax({
            url: tmpl_url,
            method: 'GET',
            async: false,
            success: function(data) {
                tmpl_string = data;
            }
        });

        render.tmpl_cache[tmpl_name] = _.template(tmpl_string);
    }

    return render.tmpl_cache[tmpl_name](tmpl_data);
}

var MonthModule;


/*
 * Global variables
 */

var dirtyFilter = true;

var idDropdownToMonth = '#to_month';
var idDropdownToYear = '#to_year';
var idDropdownFromMonth = '#from_month';
var idDropdownFromYear = '#from_year';

var idDropdownNumCols = '#num_cols';
var validator;
var edit_validator;

// Template function for the monthly entries
var templateMonthly;

// Template function for the month display section.
var templateEntries;

var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

// Populated statically now
// TODO populate based on saved values
var years = [];

// TODO Static options for 
var NUM_COLS = [ 2, 3, 4 ];

/*
 * Backbone Collections
 */

// Collection representing all the monthly entries, one Model per monthly entry
var monthly;

// Collection representing all the one_time entries, one Model per entry
var one_time;

// Collection of metadata associated with each month, one Model per month
var monthsMeta;


/*
 * Initialization
 */

function formatDollars(num, undefinedFallback, showpositive)
{
	if(typeof showpositive == "undefined")
		showpositive = false;
	if(typeof num == "undefined")
		return undefinedFallback;
	if(num < 0)
		return "-$" + Math.abs(num);
	if(showpositive)
		return "+$" + num;
	return "$" + num;
}

function initialElementSetup()
{
	populateSelectElements();
	
	// Setup the popup dialogs
	hideEntryDialog();
	getEntryDialog().css('position', 'absolute');
	
	getEditEntryDialog().hide();
	getEditEntryDialog().css('position', 'absolute');
	
	//Setup scrollbar for sidebar
	$('#sidebar').mCustomScrollbar({
		scrollInertia:0,
		scrollButtons:{
			enable:true
		}
	});
	
	//Hide the sort div
	$('.sort').hide();
}

function populateSelectElements()
{
	var d = new Date();
	for(var i = d.getFullYear() - 1; i <= d.getFullYear() + 2; i++)
	{
		years.push("" + i);
	}
	populateSelector($(idDropdownToMonth), months);
	populateSelector($(idDropdownFromMonth), months);
	populateSelector($('#selectorMonth'), months);
	populateSelector($(idDropdownToYear), years);
	populateSelector($(idDropdownFromYear), years);
	populateSelector($('#selectorYear'), years);
	populateSelector($(idDropdownNumCols), NUM_COLS);

	// From year set to current year, to year set to next year
	// From and to months set to current month
	$(idDropdownFromYear).val(d.getFullYear());
	$(idDropdownFromMonth).val(months[d.getMonth()]);
	$(idDropdownToMonth).val(months[(d.getMonth()-1) % 12]);
	$(idDropdownToYear).val(d.getFullYear() + 1);	
}

/*
 * Client-server communications 
 */

 // Retrieves the entries from the server in JSON format, then parses the data and updates the entire display
function retrieveParseRefreshEntries()
{
	var data = {
		year: $('#idYearSelector').val()
	};
	$.get("/Entries", data, onReceiveJsonEntries, "json");
}

function onReceiveJsonEntries(jsonData)
{
	parseData(jsonData);
	refreshEntries();
}

/*
 * Entry dialog modifiers
 */

// Used to remember which type of entry dialog was showing last
var selected = "";
var edit_selected = "";

function showEntryDialogUnderMonthly(el)
{
	if (selected == "monthly")
	{
		selected = "";
		hideEntryDialog();
		populateSelectElements();
		return;
	}
	selected = "monthly";
	updateEntryDialog('Add Monthly Entry', true, $(el), true, false);
}

function showEntryDialogUnderEntryHeader(el)
{
	if (selected == "transactions")
	{
		selected = "";
		hideEntryDialog();
		return;
	}
	selected = "transactions";
	updateEntryDialog('Add Entry', false, $(el), false, false);
}

function showEntryDialogUnderYearMonth($button, year, month)
{
	var key = year + ":" + month;
	if (selected == key)
	{
		selected = "";
		hideEntryDialog();
		return;
	}
	selected = key;
	var status = 'Add Entry for ' + month + " " + year;
	updateEntryDialog(status, false, $button, true, year, month, true);
}

function showEditEntryDialogUnderEntry(e)
{
	var $dialog = $('#edit_entry_div');
	var key = e.year + ":" + e.month + ":" + e.name + ":" + e.monthly;
	if (edit_selected == key)
	{
		edit_selected = "";
		$dialog.hide();
		return;
	}
	$dialog.show();
	if(e.monthly)
		$('#edit_entry_delete_all').show();
	else
		$('#edit_entry_delete_all').hide();
	
	$('#edit_input_name').prop('disabled', 'disabled');
	$('#edit_input_name').val(e.name);
	$('#edit_input_amount').val(e.amount);
	$('#edit_input_amount').focus();
	$('#edit_input_amount').select();
	if(e.amount > 0)
		$('#edit_entry_income').prop('checked', 'checked');
	else
		$('#edit_entry_expense').prop('checked', 'checked');
	
	$dialog.data('meta', e);
	
	edit_selected = key;
	var stuff = '#' + e.year + "-" + e.month + "-" + e.cid;
	var $moveTo = $(stuff);
	
	offsetElementFrom($dialog, $moveTo, true);
}

function updateEntryDialog(statusText, checkMonthlyCheckbox, $moveTo, hideMonthOption, yearSelection, monthSelection, topLeft)
{
	$('#dialog_status').html(statusText);
	if(checkMonthlyCheckbox)
		$('#checkbox_monthly').attr('checked', 'checked');
	else
		$('#checkbox_monthly').removeAttr("checked");
	
	changeDateSelector();
	
	if(yearSelection !== undefined)
		$('#selectorYear').val(yearSelection);

	if(monthSelection !== undefined)
		$('#selectorMonth').val(monthSelection);
	
	$('.month_option').toggle(!hideMonthOption);

	offsetElementFrom(getEntryDialog(), $moveTo, topLeft);
	showEntryDialog();
}

/*
 * Data helper functions
 */

function saveEntry()
{
	if(!edit_validator.form())
	{
		console.log("Form not validated.");
		return false;
	}
	var meta = getEditEntryDialog().data('meta');
	var new_amount = parseInt($('#edit_input_amount').val());
	if(meta.monthly)
	{
		var m = monthly.get(meta.name);
		m.set('amount', new_amount);
	}
	else
	{
		var m = one_time.get(meta.year + ":" + meta.month + ":" + meta.name);
		m.set('amount', new_amount);
	}
	getEditEntryDialog().hide();
	refreshEntries();
}

function editEntry(model, year, month)
{
	var monthly = model.get('monthly');
	if(monthly)
	{
		var justmonth = confirm("Would you like to modify just this month?");
		var allmonths = false;
		if(!justmonth)
		{
			allmonths = confirm("Would you like to modify all months except previously modified months?");
			if(allmonths)
			{
				var newVal = prompt("New value?");
				model.set('amount', newVal);
			}
			else
			{
				return;
			}
		}
		else
		{
			var newVal = prompt("New value?");
			adjustMonthly(year, month, model.get('name'), newVal);
		}
	}
	else
	{
		var newVal = prompt("New value?");
		m.set('amount', newVal);
	}
	refreshEntries();
}

function deleteEntry(model, year, month)
{
	if(model.get('monthly'))
	{
		var justmonth = confirm("Would you like to delete just this month?");
		if(justmonth)
		{
			deleteMonthly(year, month, model.get('name'));
		}
		else
		{
			var all = confirm("Would you like to delete all instances of this monthly entry?");
			if(all)
			{
				monthly.remove(model);
			}
		}
	}
	else
	{
		one_time.remove(model);
	}
	refreshEntries();
}

function deleteMonthly(year, month, name)
{
	var mod = {
		'type': 'delete'
	};
	putMonthlyModification(year, month, name, mod);
}

function adjustMonthly(year, month, name, amount)
{
	var mod = {
		'type': 'adjust',
		'amount': amount
	};
	putMonthlyModification(year, month, name, mod);
}

function putMonthlyModification(year, month, name, mod)
{
	var meta = monthsMeta.get(year + ":" + month);
	var modifications = meta.get('modifications');
	if(typeof modifications == "undefined")
	{
		modifications = {};
		meta.set('modifications', modifications);
	}
	modifications[name] = mod;
}

function getModifiedAmount(model, year, month)
{
	var meta = monthsMeta.get(year + ':' + month);
	var mods = meta.get('modifications');
	if(typeof mods != "undefined")
	{
		var mod = mods[model.get('name')];
		if(typeof mod != "undefined")
		{
			if(mod.type == "delete")
				return undefined;
			else if(mod.type == "adjust")
			{
				return parseInt(mod.amount);
			}
		}
	}
	return parseInt(model.get('amount'));
}

function applyMonthlyModifications(monthlyarr, mods)
{
	if(typeof mods == "undefined" || Object.keys(mods).length == 0)
		return monthlyarr;
	var ret = [];
	for(var i = 0; i < monthlyarr.length; i++)
	{
		var m = monthlyarr[i];
		var mod = mods[m.get('name')];
		if(typeof mod != "undefined")
		{
			if(mod.type == "delete")
				continue;
			if(mod.type == "adjust")
			{
				m = m.clone().set('amount', mod.amount);
			}
		}
		ret.push(m);
	}
	return ret;
}

function getNextMonthMeta(yearIndex, monthIndex)
{
	var year = parseInt(years[yearIndex]);
	if(monthIndex < months.length - 1)
		monthIndex++;
	else
	{
		monthIndex = 0;
		year++;
	}
	return "" + year + ":" + months[monthIndex];
}

function getPreviousMonthMeta(yearIndex, monthIndex)
{
	var year = parseInt(years[yearIndex]);
	if(monthIndex > 0)
		monthIndex--;
	else
	{
		monthIndex = months.length - 1;
		year--;
	}
	return "" + year + ":" + months[monthIndex];
}

function addEntry()
{
	if(!validator.form())
	{
		console.log("Form not validated.");
		return false;
	}
	var type = $('[name=entry_type]:checked').attr('title');
	var data = {
		name : $('[name=input_name]').val(),
		amount : $('[name=input_amount]').val(),
		monthly : $('[name=monthly]:checked').val() == "True",
		month : $('[name=selectorMonth]').val(),
		year : $('[name=selectorYear]').val()
	};

	if (type == "Expense")
		data.amount = -Math.abs(data.amount);
	if (type == "Income")
		data.amount = Math.abs(data.amount);

	if (data.monthly)
	{
		if(!existing)
		{
			var m = new Backbone.Model(data);
			m.set('id', data.name);
			monthly.add(m);
		}
		else
			return false;
	} 
	else
	{
		var existing = one_time.get(data.year + ":" + data.month + ":" + data.name);
		if (existing)
		{
			return false;
		} 
		else
		{
			var m = new Backbone.Model(data);
			m.set('id', data.year + ":" + data.month + ":" + data.name);
			one_time.add(m);
		}
	}
	
	$('#input_name').val('');
	$('#input_amount').val('');
	
	hideEntryDialog();
	refreshEntries(); 
	return false;
}

function saveData()
{
	data = {
		'monthly': monthly.toJSON(),
		'one_time': one_time.toJSON(),
		'months': monthsMeta.toJSON()
	};
	$.post("/Entries", JSON.stringify(data), function(result) {refreshEntries();});	
}

function parseData(data)
{
	monthly = new Backbone.Collection(data['monthly']);
	one_time = new Backbone.Collection(data['one_time']);
	monthsMeta = new Backbone.Collection(data['months']);
}

function calculateAllMonthData()
{
	for(var y = 0; y < years.length; y++)
	{
		for(var m = 0; m < months.length; m++)
		{
			var yearString = years[y];
			var monthString = months[m];
			var id = yearString + ":" + monthString;
			var meta = monthsMeta.get(id);
			if(meta == undefined)
			{
				meta = new Backbone.Model();
				meta.set('id', id);
				monthsMeta.add(meta);
			}
			
			var entries = getEntriesArrayForYearMonth(yearString, monthString);
			var total_expenses = 0;
			var total_income = 0;
			for(var e = 0; e < entries.length; e++)
			{
				var entry = entries[e];
				var amount = getModifiedAmount(entry, yearString, monthString);
				if(typeof amount == "undefined")
					continue;
				if(amount > 0)
					total_income += amount;
				else
					total_expenses -= amount;
			}
			var diff = total_income - total_expenses;
			var start_balance = meta.get('start_balance');
			var prevMonthMeta = monthsMeta.get(getPreviousMonthMeta(y, m));
			var prevEstEndBalance = undefined;
			if(prevMonthMeta != undefined)
				prevEstEndBalance = prevMonthMeta.get('est_end_balance');
			if(start_balance != undefined)
			{
				meta.set('est_end_balance', start_balance + diff);
				if(prevMonthMeta != undefined && prevEstEndBalance != undefined)
				{
					var disc = start_balance - prevEstEndBalance;
					prevMonthMeta.set('discrepancy', disc);
				}
			}
			else
			{
				if(prevMonthMeta != undefined)
				{
					if(prevEstEndBalance != undefined)
					{
						meta.set('est_start_balance', prevEstEndBalance);
						meta.set('est_end_balance', prevEstEndBalance + diff);
					}
				}
			}
			meta.set('total_income', total_income);
			meta.set('total_expenses', total_expenses);
			meta.set('difference', diff);
			meta.set('next_month', getNextMonthMeta(y, m));
			meta.set('prev_month', getPreviousMonthMeta(y, m));
		}
	}
}

function getEntriesArrayForYearMonth(year, month)
{
	var one_times = one_time.where({'year': year, 'month': month});
	return one_times.concat(monthly.toArray());
}

var entries_json = [];

function getEntriesHtml()
{
	var valid = validateFilter();
	if (!valid)
	{
		alert("Not a valid to and from filter.");
		return;
	}

	var templateData = {};
	templateData.rowData = [];
	var numCols = NUM_COLS[getNumCols()];
	templateData.entryWidth = 100 / numCols;
	
	var rowMonthsData = [];
	var curIndex = 0;
	
	for(var j = 0; j < yearMonthIteratorData.length; j++)
	{
		var month = yearMonthIteratorData[j];
		
		monthData = {};
		monthData.month = month.month;
		monthData.year = month.year;
		
		curIndex++;
		rowMonthsData.push(monthData);
		if(curIndex == numCols || month.month == "December")
		{
			curIndex = 0;
			templateData.rowData.push(rowMonthsData);
			rowMonthsData = [];
		}
	}
	if(rowMonthsData.length > 0)
		templateData.rowData.push(rowMonthsData);
	
	return render('entries_table', templateData);
}

var monthModuleViews = {};

function fillMonths()
{
	for(var j = 0; j < yearMonthIteratorData.length; j++)
	{
		var month = yearMonthIteratorData[j];
		var key = month.year + ":" + month.month;
		var module = monthModuleViews[key];
		var $stuff = $('.' + month.month).filter('.' + month.year);
		if(typeof module == "undefined")
		{
			var meta = monthsMeta.get(month.year + ":" + month.month);
			module = new MonthModule({
				el: $stuff
			}, month.year, month.month, meta);
			monthModuleViews[key] = module;
		}
		if(dirtyFilter)
		{
			module.el = $stuff;
			module.$el = $stuff;
			module.delegateEvents();
		}
		module.calculate();
		module.render();
	}
}

var yearMonthIteratorData;

function updateYearMonthIterator()
{
	yearMonthIteratorData = [];
	
	var toMonth = getSelectedIndex(idDropdownToMonth);
	var fromMonth = getSelectedIndex(idDropdownFromMonth);
	var toYear = getSelectedIndex(idDropdownToYear);
	var fromYear = getSelectedIndex(idDropdownFromYear);
	
	// Iterate through each year from the starting year to the ending year
	for ( var currentYearNum = fromYear; currentYearNum <= toYear; currentYearNum++)
	{
		// If the current year is the first year of the selection then the starting 
		// month will be the selected starting month, otherwise we start at January.
		var startingMonthNum = (currentYearNum == fromYear) ? fromMonth : 0;

		// If the current year is the last year of the selection then the ending
		// month will be the selected ending month, otherwise we end at December.
		var endingMonthNum = (currentYearNum == toYear) ? toMonth : 11;

		for ( var currentMonthNum = startingMonthNum; currentMonthNum <= endingMonthNum; currentMonthNum++)
		{
			var currentMonthStr = months[currentMonthNum];
			var currentYearStr = years[currentYearNum];
			var obj = {
				month: currentMonthStr,
				year: currentYearStr,
				month_num: currentMonthNum,
				year_num: currentYearNum,
				meta: monthsMeta.get(currentYearStr + ":" + currentMonthStr)
			};
			yearMonthIteratorData.push(obj);
		}
	}
}

/*
 * JQuery helper functions
 */

function getEntryDialog()
{
	return $('#add_dialog_div');
}

function getEditEntryDialog()
{
	return $('#edit_entry_div');
}

function hideEditEntryDialog()
{
	edit_selected = "";
	getEditEntryDialog().data('meta', undefined);
	getEditEntryDialog().hide();
}

function hideEntryDialog()
{
	selected = "";
	getEntryDialog().hide();
}

function showEntryDialog()
{
	getEntryDialog().show();
	validator.resetForm();
	$('#input_name').focus();
	$('#input_name').select();
}

function refreshEntries()
{
	calculateAllMonthData();
	if(dirtyFilter)
	{
		updateYearMonthIterator();
		$('#entries').html(getEntriesHtml());
	}

	fillMonths();
	
	dirtyFilter = false;
	
	$('#monthly_entries').html(render('monthly_entries', monthly.toArray()));
	$('.start_balance_input').hide();
	$('.show_on_hover').hide();
	$('.editable_entry').hover(
		function() {
			$(this).find('.show_on_hover').show();
		},
		function() {
			$(this).find('.show_on_hover').hide();
		}
	);
}

function offsetElementFrom($toMove, $toOffsetFrom, topLeft)
{
	var offsetX, offsetY;

	offsetY = $toOffsetFrom.height();
	if(topLeft)
		offsetX = -$toMove.width();
	else
		offsetX = $toOffsetFrom.width();
	
	var off = $toOffsetFrom.offset();
	off.left += offsetX;
	off.top += offsetY;
	$toMove.css(off);
}

function populateSelector(selector, options)
{
	var $sel = $(selector);
	$sel.html('');
	for ( var i = 0; i < options.length; i++)
	{
		$sel.append("<option value='" + options[i] + "'>" + options[i] + "</option>");
	}
}

function validateFilter()
{
	var toMonth = getSelectedIndex(idDropdownToMonth);
	var fromMonth = getSelectedIndex(idDropdownFromMonth);
	var toYear = getSelectedIndex(idDropdownToYear);
	var fromYear = getSelectedIndex(idDropdownFromYear);

	if (fromYear <= toYear && (fromMonth <= toMonth || toYear > fromYear))
		return true;
	return false;
}

function changeDateSelector()
{
	if ($('#checkbox_monthly').is(':checked'))
	{
		$('.monthly_options').hide();
	} else
	{
		$('.monthly_options').show();
	}
}

function getNumCols()
{
	return $(idDropdownNumCols).prop('selectedIndex');
}

function getSelectedIndex(id)
{
	return $(id).prop('selectedIndex');
}

function toggleSort()
{
	$('.sort').slideToggle();
}

/*
 * Underscore collection filters
 */

function yearMonthFilter(year, month)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month;
	};
}

function nameFilter(name)
{
	return function(obj)
	{
		return obj.get('name') == name;
	};
}

function yearMonthNameFilter(year, month, name)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month && obj.get('name') == name;
	};
}

// Custom JQuery Validators
function addCustomValidators()
{
	jQuery.validator.addMethod("alphanumeric", function(value, element) {
        return this.optional(element) || /^[a-zA-Z0-9]+$/.test(value);
	});
	jQuery.validator.addMethod("numeric", function(value, element) {
        return this.optional(element) || /^[0-9]+$/.test(value);
	});
	jQuery.validator.addMethod("existing_name", function(value, element) {
		var is_monthly = $('[name=monthly]:checked').val();
		var month = $('[name=selectorMonth]').val();
		var year = $('[name=selectorYear]').val();
		var monthly_exists = monthly.get(value);
		var one_time_exists = one_time.get(year + ":" + month + ":" + value);
		var lst = one_time.filter(nameFilter(value));
		if(is_monthly)
			return !(monthly_exists || lst.length > 0);
		return !monthly_exists && !one_time_exists;
	});
}

function initializeValidation()
{
	validator = $('#add_dialog_form').validate({
		rules: {
			input_name: {
				required: true,
				existing_name: true
			},
			input_amount: {
				required: true,
				numeric: true
			}
		},
		messages: {
			input_name: "",
			input_amount: ""
		},
		onkeyup: false
	});
	
	edit_validator = $('#edit_entry_form').validate({
		rules: {
			edit_input_amount: {
				required: true,
				numeric: true
			}
		},
		messages: {
			edit_input_name: "",
			edit_input_amount: ""
		},
		onkeyup: false
	});
}