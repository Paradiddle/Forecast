$(document).ready(function()
{
	retrieveEntries();
	/*
	 * if (typeof String.prototype.startsWith != 'function') {
	 * String.prototype.startsWith = function(str) { return this.slice(0,
	 * str.length) == str; }; }
	 */
	populateSelector($('#to_month'), months);
	populateSelector($('#from_month'), months);
	populateSelector($('#selectorMonth'), months);
	populateSelector($('#to_year'), years);
	populateSelector($('#from_year'), years);
	populateSelector($('#selectorYear'), years);

	hideEntryDialog();
	getEntryDialog().css('position', 'absolute');
	$('#to_month').val('December');

	_.templateSettings.variable = "rc";
	templateMonthly = _.template($("script.template").html());
	templateEntries = _.template($("script.entries").html());
});

/*
 * Global variables
 */

var templateMonthly;
var templateEntries;

var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
var years = [ 2011, 2012, 2013 ];

var monthly;
var one_time;
var monthsMeta;
var selected;

/*
 * Client-server communications 
 */

function addEntry()
{
	var data =
	{
		name : $('[name=input_name]').val(),
		amount : $('[name=input_amount]').val(),
		monthly : $('[name=monthly]:checked').val(),
		month : $('[name=selectorMonth]').val(),
		year : $('[name=selectorYear]').val(),
		type : $('[name=entry_type]:checked').attr('title')
	};

	if (data.type == "Income")
		data.income = data.amount;
	else
		data.expense = data.amount;

	if (data.monthly)
	{
		var existing = monthly.get(data.name);
		if (existing)
		{
			var prev_amount = existing.get('amount');
			if (prev_amount == data.amount)
				return false;
			var update = confirm("There is already a monthly entry with the name " + data.name
					+ ". Would you like to update the default amount from " + prev_amount + " to " + data.amount);
			if (!update)
				return false;
		}
		var m = new Backbone.Model(data);
		m.id = data.name;
		monthly.add(m);
	} 
	else
	{
		var existing = one_time.get(data.year + ":" + data.month + ":" + data.name);
		if (existing)
		{
			var prev_amount = existing.get('amount');
			if (prev_amount == data.amount)
				return false;
			var update = confirm("There is already a one time entry with the name " + data.name + " for the month "
					+ data.month + " of " + data.year + ". Would you like to update that entry's amount from "
					+ prev_amount + " to " + data.amount);
			if (!update)
				return false;
			existing.set('amount', data.amount);
			expandExpenseProperty(existing);
		} else
		{
			var m = new Backbone.Model(data);
			m.id = (data.year + ":" + data.month + ":" + data.name);
			one_time.add(m);
		}
	}
	
	// TODO print out the response of this ajax to a notification area
	// TODO design a meaningful serverside response other than 'success'
	$.ajax(
	{
		url : "/",
		type : "POST",
		data : data,
		success : function(result)
		{
			refreshEntries();
		}
	});
	return false;
}

/**
 * Retrieves the entries from the server in JSON format
 */
function retrieveEntries()
{
	var data = {};
	data.year = $('#idYearSelector').val();
	$.get("/Entries", data, onReceiveJsonEntries, "json");
}

function refreshEntries()
{
	$('#monthly_entries').html(templateMonthly(monthly.toArray()));
	$('#entries').html(getEntriesHtml());	
	$("button").button();
	$('#addentry').validate();
	$('.start_balance_input').hide();
}

function onReceiveJsonEntries(jsonData)
{
	parseData(jsonData);
	refreshEntries();
}

/*
 * Entry dialog modifiers
 */

function showEntryDialogUnderMonthly(el)
{
	if (selected == "monthly")
	{
		selected = "";
		hideEntryDialog();
		return;
	}
	selected = "monthly";
	updateEntryDialog('Add Monthly Entry', true, $(el), true, true, false);
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
	updateEntryDialog('Add Entry', false, $(el), false, false, false);
}

function showEntryDialogUnderYearMonth(year, month)
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
	var $moveTo = $('#' + year + "-" + month);
	updateEntryDialog(status, false, $moveTo, true, true, year, month, true);
}

function updateEntryDialog(statusText, checkMonthlyCheckbox, $moveTo, hideMonthOption, disableMonthlyOptions, yearSelection, monthSelection, topLeft)
{
	$('#dialog_status').html(statusText);
	if(checkMonthlyCheckbox)
		$('#checkbox_monthly').attr('checked', 'checked');
	else
		$('#checkbox_monthly').removeAttr("checked");
	
	changeDateSelector();
	showEntryDialog();
	
	if(!disableMonthlyOptions)
	{
		$('#selectorYear').removeAttr('disabled', 'disabled');
		$('#selectorMonth').removeAttr('disabled', 'disabled');
		$('#checkbox_monthly').removeAttr('disabled', 'disabled');
	}
	else
	{
		$('#selectorYear').attr('disabled', 'disabled');
		$('#selectorMonth').attr('disabled', 'disabled');
		$('#checkbox_monthly').attr('disabled', 'disabled');
	}
	
	if(yearSelection !== undefined)
		$('#selectorYear').val(yearSelection);

	if(monthSelection !== undefined)
		$('#selectorMonth').val(monthSelection);
	
	if(hideMonthOption)
		$('.month_option').hide();
	else
		$('.month_option').show();

	offsetElementFrom(getEntryDialog(), $moveTo, topLeft);
}

function updateStartingBalance(year, month)
{
	var $input = $('#start_balance_input' + year + month);
	var $label = $('#start_balance_label' + year + month);
	var new_start_bal = parseInt($input.val());
	
	var m = monthsMeta.get(year + ":" + month);
	if(m == undefined)
	{
		m = new Backbone.Model();
		m.set('id', year + ":" + month);
		monthsMeta.add(m);
	}
	var data = {
		month: month,
		year: year,
		start_balance: new_start_bal
	};
	$.post("/UpdateMonth", data);
	m.set('start_balance', new_start_bal);
	refreshEntries();
}

function showInputForStartingBalance(year, month)
{
	var $input = $('#start_balance_input' + year + month);
	var $label = $('#start_balance_label' + year + month);
	var $button = $('#start_balance_button' + year + month);
	$('.start_balance_input').hide();
	$('.start_balance_label').show();
	$input.show();
	$button.show();
	$input.val($label.html());
	$input.focus();
	$input.select();
	$label.hide();
}

function getEntryDialog()
{
	return $('#dialog_form');
}

function hideEntryDialog()
{
	selected = "";
	getEntryDialog().hide();
}

function showEntryDialog()
{
	getEntryDialog().show();
}

/*
 * JQuery helper functions
 */

function offsetElementFrom($toMove, $toOffsetFrom, topLeft)
{
	var offsetX, offsetY;
	
	if(topLeft)
	{
		offsetX = -$toMove.width();
		offsetY = -$toMove.height() + $toOffsetFrom.height();
	}
	else
	{
		offsetX = $toOffsetFrom.width() + 15;
		offsetY = $toOffsetFrom.height() + 5;
	}
	
	var off = $toOffsetFrom.offset();
	off.left += offsetX;
	off.top += offsetY;
	$toMove.css(off);
}

function populateSelector(selector, options)
{
	var $sel = $(selector);
	for ( var i = 0; i < options.length; i++)
	{
		$sel.append("<option value='" + options[i] + "'>" + options[i] + "</option>");
	}
}

function validateFilter()
{
	var toMonth = $('#to_month').prop('selectedIndex');
	var fromMonth = $('#from_month').prop('selectedIndex');
	var toYear = $('#to_year').prop('selectedIndex');
	var fromYear = $('#from_year').prop('selectedIndex');

	if (fromYear <= toYear && fromMonth <= toMonth)
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

/*
 * Underscore collection filters
 */

function yearMonthFilter(year, month)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month;
	}
}

function yearMonthNameFilter(year, month, name)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month && obj.get('name') == name;
	}
}

/*
 * Data helper functions
 */

function parseData(data)
{
	monthly = new Backbone.Collection(data['monthly']);
	one_time = new Backbone.Collection(data['one_time']);
	monthsMeta = new Backbone.Collection(data['months']);

	monthly.each(expandExpenseProperties());
	one_time.each(expandExpenseProperties());
}

function expandExpenseProperties()
{
	return function(value, index)
	{
		expandExpenseProperty(value);
	}
}

function expandExpenseProperty(value)
{
	if (value.get('type') == "Income")
		value.set('income', value.get('amount'));
	else
		value.set('expense', value.get('amount'));
}

function getEntriesHtml()
{
	var valid = validateFilter();
	if (!valid)
	{
		alert("Not a valid to and from filter.");
		return;
	}

	var toMonth = $('#to_month').prop('selectedIndex');
	var fromMonth = $('#from_month').prop('selectedIndex');
	var toYear = $('#to_year').prop('selectedIndex');
	var fromYear = $('#from_year').prop('selectedIndex');

	var templateData = {};
	templateData.rowData = [];
	templateData.numCols = 5;
	var previousStartingBalance;
	var previousExpenses;
	var previousIncome;
	var previousEstimate;
	var maxEntries = 0;
	
	var rowMonthsData = [];
	var curIndex = 0;
	
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
			var currentMonth = monthsMeta.get(currentYearStr + ":" + currentMonthStr);
			var currentStartBalance = undefined;
			if(currentMonth != undefined)
			{
				currentStartBalance = parseInt(currentMonth.get('start_balance'));
			}
			monthData = {};
			monthData.monthid = currentYearStr + ", '" + currentMonthStr + "'";
			monthData.month = currentMonthStr;
			monthData.year = currentYearStr;
			monthData.entries = one_time.filter(yearMonthFilter(currentYearStr, currentMonthStr));
			
			total_expenses = 0
			total_income = 0
			
			if(monthData.entries.length > maxEntries)
				maxEntries = monthData.entries.length;
			for(var e in monthData.entries)
			{
				var entry = monthData.entries[e];
				var amount = parseInt(entry.get('amount'));
				if(entry.get('type') == "Income")
					total_income += parseInt(amount);
				else
					total_expenses += parseInt(amount);
			}
			
			monthData.total_expenses = total_expenses;
			monthData.total_income = total_income;
			
			if(currentStartBalance != undefined)
			{
				monthData.start_balance = currentStartBalance;
				if(previousEstimate != undefined)
				{
					monthData.difference = (currentStartBalance - previousEstimate);
				}
			}
			else if(previousStartingBalance != undefined)
			{
				var newBalance = previousStartingBalance;
				if(previousExpenses != undefined)
					newBalance -= previousExpenses;
				if(previousIncome != undefined)
					newBalance += previousIncome;
				monthData.start_balance = newBalance;
			}
			
			previousIncome = total_income;
			previousExpenses = total_expenses;
			previousStartingBalance = monthData.start_balance;
			previousEstimate = previousStartingBalance + previousIncome - previousExpenses;

			curIndex++;
			rowMonthsData.push(monthData);
			if(curIndex == templateData.numCols)
			{
				curIndex = 0;
				templateData.rowData.push(rowMonthsData);
				rowMonthsData = [];
			}
		}
	}
	if(rowMonthsData.length > 0)
		templateData.rowData.push(rowMonthsData);
	console.log(templateData);
	
	templateData.maxEntries = maxEntries;
	return templateEntries(templateData);
}

function getMonthMetaAfterYearMonth(year, month)
{
	if(month == "December")
	{
		return monthsMeta.get("")
	}
}

/*
 * Window helpers
 */

function f_clientWidth() {
	return f_filterResults (
		window.innerWidth ? window.innerWidth : 0,
		document.documentElement ? document.documentElement.clientWidth : 0,
		document.body ? document.body.clientWidth : 0
	);
}

function f_clientHeight() {
	return f_filterResults (
		window.innerHeight ? window.innerHeight : 0,
		document.documentElement ? document.documentElement.clientHeight : 0,
		document.body ? document.body.clientHeight : 0
	);
}

function f_filterResults(n_win, n_docel, n_body) {
	var n_result = n_win ? n_win : 0;
	if (n_docel && (!n_result || (n_result > n_docel)))
		n_result = n_docel;
	return n_body && (!n_result || (n_result > n_body)) ? n_body : n_result;
}