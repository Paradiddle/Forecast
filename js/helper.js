$(document).ready(function()
{
	retrieveTransactions();
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

	$('#dialog-form').hide();
	$('#dialog-form').css('position', 'absolute');
	$('#to_month').val('December');

	_.templateSettings.variable = "rc";
	template = _.template($("script.template").html());
	entries = _.template($("script.entries").html());
});

var template;
var entries;

var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
var years = [ 2011, 2012, 2013 ];

var monthly;
var one_time;
var selected;

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

var addMonthlyTransactions = function()
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
	} else
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

	$.ajax(
	{
		url : "/",
		type : "POST",
		data : data,
		success : function(result)
		{
			refreshTransactions();
		}
	});
	return false;
};

var retrieveTransactions = function()
{
	var data =
	{
		year : $('#idYearSelector').val()
	};
	$.ajax(
	{
		url : "/Transactions",
		dataType : "json",
		data : data,
		type : "POST",
		success : function(result)
		{
			parseData(result);
			refreshTransactions();
		}
	});
};

var refreshTransactions = function()
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

	var $transactionsDiv = $('#transactions');
	$transactionsDiv.html("");

	var templateData =
	{};
	templateData.monthsData =
	[];

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
			monthData = {};
			monthData.month = currentMonthStr;
			monthData.year = currentYearStr;
			monthData.entries = one_time.filter(yearMonthFilter(currentYearStr, currentMonthStr));

			templateData.monthsData.push(monthData);
		}
	}
	$transactionsDiv.append(entries(templateData));
	$('#monthly_transactions').html(template(monthly.toArray()));
};

function parseData(data)
{
	monthly = new Backbone.Collection(data['monthly']);
	one_time = new Backbone.Collection(data['one_time']);

	monthly.each(expandExpenseProperties());
	one_time.each(expandExpenseProperties());
}

function oneTimeKey(year, month, name)
{
	return year + ":" + month + ":" + name;
}

var getTable = function(headers, props, data)
{
	var $table = $('<table cellspacing="5" />');

	for ( var i = 0; i < headers.length; i++)
	{
		var header = headers[i];
		$table.append('<th>' + header + '</th>');
	}

	for ( var j = 0; j < data.length; j++)
	{
		var elem = data[j];
		var $row = $('<tr />');
		for ( var i = 0; i < props.length; i++)
		{
			var prop = props[i];
			var val = elem.has(prop) ? elem.get(prop) : "-";
			var $cell = $('<td>' + val + '</td>');
			$row.append($cell);
		}
		$table.append($row);
	}
	return $table;
};

var changeDateSelector = function()
{
	if ($('#checkbox_monthly').is(':checked'))
	{
		$('.monthly_options').hide();
	} else
	{
		$('.monthly_options').show();
	}
};

var offsetElementFrom = function($toMove, $toOffsetFrom, offsetX, offsetY)
{
	if(offsetX === undefined)
		offsetX = 35;
	if(offsetY === undefined)
		offsetY = 15;
	
	var off = $toOffsetFrom.offset();
	off.left += offsetX;
	off.top += offsetY;
	$toMove.css(off);
};

function showFormUnderMonthly()
{
	if (selected == "monthly")
	{
		selected = "";
		hideEntryDialog();
		return;
	}
	selected = "monthly";
	var $moveTo = $('#monthly_button');
	updateEntryDialog('Add Monthly Entry', true, $moveTo, true, true);
}

function showFormUnderTransactions()
{
	if (selected == "transactions")
	{
		selected = "";
		hideEntryDialog();
		return;
	}
	selected = "transactions";
	var $moveTo = $('#transactions_button');
	updateEntryDialog('Add Entry', false, $moveTo, false, false);
}

function moveFormToYearMonth(year, month)
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
	updateEntryDialog(status, false, $moveTo, true, true, year, month);
}

function updateEntryDialog(statusText, checkMonthlyCheckbox, $moveTo, hideMonthOption, disableMonthlyOptions, yearSelection, monthSelection)
{
	$('#dialog_status').html(statusText);
	offsetElementFrom(getEntryDialog(), $moveTo);
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
}

function getEntryDialog()
{
	return $('#dialog-form');
}

function hideEntryDialog()
{
	getEntryDialog().hide();
}

function showEntryDialog()
{
	getEntryDialog().show();
}

function yearMonthFilter(year, month)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month;
	}
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

function yearMonthNameFilter(year, month, name)
{
	return function(obj)
	{
		return obj.get('year') == year && obj.get('month') == month && obj.get('name') == name;
	}
}

function populateSelector(selector, options)
{
	var $sel = $(selector);
	for ( var i = 0; i < options.length; i++)
	{
		$sel.append("<option value='" + options[i] + "'>" + options[i] + "</option>");
	}
}