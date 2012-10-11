$(document).ready(function()
{
	var d = new Date();
	for(var i = d.getFullYear() - 1; i <= d.getFullYear() + 2; i++)
	{
		years.push(i);
	}
	populateSelector($(idDropdownToMonth), months);
	populateSelector($(idDropdownFromMonth), months);
	populateSelector($('#selectorMonth'), months);
	populateSelector($(idDropdownToYear), years);
	populateSelector($(idDropdownFromYear), years);
	populateSelector($('#selectorYear'), years);
	populateSelector($(idDropdownNumCols), num_cols);
	
	$(idDropdownFromYear).val(d.getFullYear());
	$(idDropdownFromMonth).val(months[d.getMonth()]);
	$(idDropdownToMonth).val(months[d.getMonth()]);
	$(idDropdownToYear).val(d.getFullYear() + 1);
	
	retrieveEntries();

	hideEntryDialog();
	getEntryDialog().css('position', 'absolute');

	_.templateSettings.variable = "data";
	templateMonthly = _.template($("script.template").html());
	templateEntries = _.template($("script.entries").html());
});

/*
 * Global variables
 */

var idDropdownToMonth = '#to_month';
var idDropdownToYear = '#to_year';
var idDropdownFromMonth = '#from_month';
var idDropdownFromYear = '#from_year';

var idDropdownNumCols = '#num_cols';


var templateMonthly;
var templateEntries;

var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
var years = [];
var num_cols = [ 3, 4, 5, 6];

var monthly;
var one_time;
var monthsMeta;
var selected;

/*
 * Client-server communications 
 */

function addEntry()
{
	var data = {
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
	refreshEntries();
	return false;
}

/**
 * Retrieves the entries from the server in JSON format
 */
function retrieveEntries()
{
	var data = {
		year: $('#idYearSelector').val()
	};
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
	updateEntryDialog(status, false, $moveTo, true, year, month, true);
}

function updateEntryDialog(statusText, checkMonthlyCheckbox, $moveTo, hideMonthOption, yearSelection, monthSelection, topLeft)
{
	$('#dialog_status').html(statusText);
	if(checkMonthlyCheckbox)
		$('#checkbox_monthly').attr('checked', 'checked');
	else
		$('#checkbox_monthly').removeAttr("checked");
	
	changeDateSelector();
	showEntryDialog();
	
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
	var new_start_bal = parseInt($input.val());
	
	var m = monthsMeta.get(year + ":" + month);
	if(m == undefined)
	{
		m = new Backbone.Model();
		m.set('id', year + ":" + month);
		monthsMeta.add(m);
	}
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

function yearMonthNameFilter(year, month, name)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month && obj.get('name') == name;
	};
}

/*
 * Data helper functions
 */

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

	monthly.each(expandExpenseProperties());
	one_time.each(expandExpenseProperties());
}

function expandExpenseProperties()
{
	return function(value, index)
	{
		expandExpenseProperty(value);
	};
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

	var toMonth = getSelectedIndex(idDropdownToMonth);
	var fromMonth = getSelectedIndex(idDropdownFromMonth);
	var toYear = getSelectedIndex(idDropdownToYear);
	var fromYear = getSelectedIndex(idDropdownFromYear);

	var templateData = {};
	templateData.rowData = [];
	templateData.numCols = num_cols[getNumCols()];
	var previousStartingBalance = undefined;
	var previousExpenses = undefined;
	var previousIncome = undefined;
	var previousEstimate = undefined;
	var maxEntries = 0;
	
	var rowMonthsData = [];
	var curIndex = 0;
	var lastMonthData = undefined;
	
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
			monthData.entries = monthly.toArray().concat(one_time.filter(yearMonthFilter(currentYearStr, currentMonthStr)));
			
			total_expenses = 0;
			total_income = 0;
			
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
			
			monthData.end_balance = previousEstimate;
			
			if(lastMonthData != undefined && lastMonthData.end_balance != undefined)
			{
				lastMonthData.discrepancy = monthData.start_balance - lastMonthData.end_balance;
			}
			
			curIndex++;
			rowMonthsData.push(monthData);
			if(curIndex == templateData.numCols)
			{
				curIndex = 0;
				templateData.rowData.push(rowMonthsData);
				rowMonthsData = [];
			}
			lastMonthData = monthData;
		}
	}
	if(rowMonthsData.length > 0)
		templateData.rowData.push(rowMonthsData);
	
	templateData.maxEntries = maxEntries;
	return templateEntries(templateData);
}

function getMonthMetaAfterYearMonth(year, month)
{
	if(month == "December")
	{
		return monthsMeta.get("");
	}
}