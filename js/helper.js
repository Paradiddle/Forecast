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

	$('#to_month').val('December');
});

var months =
[ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
		"December" ];
var years =
[ 2011, 2012, 2013 ];

var monthly;
var one_time;
var modified;

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
		year : $('[name=selectorYear]').val()
	};

	if (data.monthly)
	{
		if (monthly.hasOwnProperty(data.input_name))
		{
			var prev_amount = monthly[data.input_name].default_amount;
			if (prev_amount == data.input_amount)
				return false;
			var update = confirm("There is already a monthly entry with the name " + data.input_name
					+ ". Would you like to update the default amount from " + prev_amount + " to " + data.input_amount);
			if (!update)
				return false;
		}
		monthly[data.input_name] = data;
	} else
	{
		var coll = one_time.filter(yearMonthNameFilter(data.year, data.month, data.name));
		if (coll.length >= 1)
		{
			var matching = coll[0];
			var prev_amount = matching.get('amount');
			if (prev_amount == data.input_amount)
				return false;
			var update = confirm("There is already a one time entry with the name " + data.name
					+ " for the month " + data.month + " of " + data.year
					+ ". Would you like to update that entry's amount from " + prev_amount + " to " + data.input_amount);
			if (!update)
				return false;
		}
		var m = new Backbone.Model(data);
		one_time.add(m);
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
			var year = years[y];
			var month = months[m];

			var $div = $('<div />');
			$div.css('background-color', "#EEEEEE");
			$div.append("<h3>" + month + " - " + year + "</h3>");
			$div.append("<h4>One Time</h4>");

			var coll = one_time.filter(yearMonthFilter(year, month));

			var $table = getTable(
				[ 'Name', 'Amount' ],
				[ 'name', 'amount' ], coll);
				$div.append($table);
				$div.append("<h4>Monthly</h4>");

			$div.append(getTable(
				[ 'Name', 'Amount' ],
				[ 'name', 'default_amount' ], monthly.toArray()));
				$t.append($div);
		}
	}
	$('#monthly_transactions').html(getTable(
	[ 'Name', 'Amount' ],
	[ 'name', 'default_amount' ], monthly.toArray()));
};

function parseData(data)
{
	monthly = new Backbone.Collection(data['monthly']);
	one_time = new Backbone.Collection(data['one_time']);
	modified = new Backbone.Collection(data['modified']);
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

var showFormUnderMonthly = function()
{
	var $input = $('#dialog-form');
	$input.insertBefore($('#monthly_transactions'));
	if ($input.css('display') === 'block')
		$input.css('display', 'none');
	else
		$input.css('display', 'block');
};

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

function populateSelector(selector, options)
{
	var $sel = $(selector);
	for ( var i = 0; i < options.length; i++)
	{
		$sel.append("<option>" + options[i] + "</option>");
	}
}