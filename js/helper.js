$(document).ready(function()
{
	retrieveTransactions();

	if (typeof String.prototype.startsWith != 'function')
	{
		String.prototype.startsWith = function(str)
		{
			return this.slice(0, str.length) == str;
		};
	}

	populateSelector($('#to_month'), months);
	populateSelector($('#from_month'), months);
	populateSelector($('#to_year'), years);
	populateSelector($('#from_year'), years);

	$('#dialog-form').hide();
	$('#dialog-form').css('position', 'absolute');
	$('#to_month').val('December');
});

var months =
[ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
		"December" ];
var years =
[ 2011, 2012, 2013 ];

var monthly;
var one_time;
var selected;

function validateFilter()
{
	$tmonth = $('#to_month');
	$fmonth = $('#from_month');
	$tyear = $('#to_year');
	$fyear = $('#from_year');

	var tmonthindex = $tmonth.prop('selectedIndex');
	var fmonthindex = $fmonth.prop('selectedIndex');
	var tyearindex = $tyear.prop('selectedIndex');
	var fyearindex = $fyear.prop('selectedIndex');

	if (fyearindex <= tyearindex && fmonthindex <= tmonthindex)
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
	
	if(data.type == "Income")
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
			var update = confirm("There is already a one time entry with the name " + data.name
					+ " for the month " + data.month + " of " + data.year
					+ ". Would you like to update that entry's amount from " + prev_amount + " to " + data.amount);
			if (!update)
				return false;
			existing.set('amount', data.amount);
			expandExpenseProperty(existing);
		}
		else
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

	var tmonthindex = $('#to_month').prop('selectedIndex');
	var fmonthindex = $('#from_month').prop('selectedIndex');
	var tyearindex = $('#to_year').prop('selectedIndex');
	var fyearindex = $('#from_year').prop('selectedIndex');

	var $t = $('#transactions');
	$t.html("");
	
	var $ttable = $('#transactions_table');

	var $outerTable = $('<table />');
	
	for ( var y = fyearindex; y <= tyearindex; y++)
	{
		var currentYear = years[y];

		var m;
		if (fyearindex == tyearindex || y == fyearindex)
			m = fmonthindex;
		else
			m = 0;

		var tmonth;
		if (y == fyearindex)
			tmonth = tmonthindex;
		else
			tmonth = 11;
		for (; m <= tmonth; m++)
		{
			var $rowOne = $('<tr />');
			
			var year = years[y];
			var month = months[m];

			var $button = $('<button>+</button>');
			$button.attr('onclick', "moveFormToYearMonth(" + year + ",'" + month + "');");
			$button.attr('id', year + "-" + month);

			$rowOne.append('<td>' + year + ' - ' + month + '</td>');
			$rowOne.css('font-style', 'bold');
			
			var $addButtonCell = $('<td />');
			$addButtonCell.append($button);
			$rowOne.append($addButtonCell);
			
			$outerTable.append($rowOne);
			
			var $rowTwo = $('<tr />');
			
			var coll = one_time.filter(yearMonthFilter(year, month));
			if(coll.length > 0)
			{
				var $table = getTable(
					[ 'Name', 'Expense', 'Income' ],
					[ 'name', 'expense', 'income' ], coll);
				var $dataCell = $('<td />');
				$dataCell.append($table);
				$rowTwo.append($dataCell);
			}
			else
				$rowTwo.append('<td />');
			$outerTable.append($rowTwo);
			var $addCell = $('<td />');
			$rowTwo.append($addCell);
			$addCell.css('padding-bottom', '30px');
			$rowOne.css('background-color', '#CCCCCC');
			$rowTwo.css('background-color', '#EEEEEE');
		}
		$t.append($outerTable);
	}
	$('#monthly_transactions').html(getTable([ 'Name', 'Expense', 'Income'], [ 'name', 'expense', 'income' ], monthly.toArray()));
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
	var $table = $('<table />');

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

var offsetElementFrom = function($toMove, $toOffsetFrom)
{
	var off = $toOffsetFrom.offset();
	off.left += 35;
	off.top += 15;
	$toMove.css(off);
};

var showFormUnderMonthly = function()
{
	var $input = $('#dialog-form');
	if(selected == "monthly")
	{
		selected = "";
		$input.hide();
		return;
	}
	selected = "monthly";
	$('#dialog_status').html('Add Monthly Entry');
	$input.show();
	var $b = $('#monthly_button');
	offsetElementFrom($input, $b);
	
	$('#checkbox_monthly').attr("checked", "checked");
	changeDateSelector();
	$('#selectorYear').removeAttr('disabled', 'disabled');
	$('#selectorMonth').removeAttr('disabled', 'disabled');
	$('#checkbox_monthly').attr('disabled', 'disabled');
	$('.month_option').hide();
};

var showFormUnderTransactions = function()
{
	var $input = $('#dialog-form');
	if(selected == "transactions")
	{
		selected = "";
		$input.hide();
		return;
	}
	selected = "transactions";
	$('#dialog_status').html('Add Entry');
	$input.show();
	offsetElementFrom($input, $('#transactions_button'));
	
	$('#checkbox_monthly').removeAttr("checked");
	changeDateSelector();
	$('#selectorYear').removeAttr('disabled', 'disabled');
	$('#selectorMonth').removeAttr('disabled', 'disabled');
	$('#checkbox_monthly').removeAttr('disabled', 'disabled');
	$('.month_option').show();
};

function moveFormToYearMonth(year, month)
{
	var $input = $('#dialog-form');
	if(selected == year + ":" + month)
	{
		selected = "";
		$input.hide();
		return;
	}
	selected = year + ":" + month;
	$('#dialog_status').html('Add Entry for ' + month + " " + year);
	$input.show();
	var $toInsertAfter = $("#" + year + "-" + month);
	offsetElementFrom($input, $toInsertAfter);
	$('#checkbox_monthly').removeAttr("checked");
	changeDateSelector();
	$('#selectorYear').val(year);
	$('#selectorMonth').val(month);
	$('#selectorYear').attr('disabled', 'disabled');
	$('#selectorMonth').attr('disabled', 'disabled');
	$('#checkbox_monthly').attr('disabled', 'disabled');
	$('.month_option').hide();
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
	if(value.get('type') == "Income")
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