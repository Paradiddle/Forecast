$(document).ready(function() {
	updateTransactions();
});

var addMonthlyTransactions = function()
{
	var data = 
	{
		input_name: $('[name=input_name]').val(),
		input_amount: $('[name=input_amount]').val(),
		monthly: $('[name=monthly]:checked').val(),
		month: $('[name=selectorMonth]').val(),
		year: $('[name=selectorYear]').val()
	};
	$.ajax({
		url: "/",
		type: "POST",
		data: data,
		success: function(result) {
			updateTransactions();
		}
	});
	return false;
}

var showFormUnderMonthly = function()
{
	var $input = $('#dialog-form');
	$input.insertBefore($('#monthly_transactions'));
	if($input.css('display') === 'block')
		$input.css('display', 'none');
	else
		$input.css('display', 'block');
};

var updateTransactions = function()
{
	var data = 
	{
		year: $('#idYearSelector').val()
	};
	$.ajax({
		url: "/Transactions",
		dataType: "json",
		data: data,
		type: "POST",
		success: function(result) {
			console.log(result);
			$('#monthly_transactions').html(getTable(['Name', 'Amount'], ['name', 'default_amount'], result['monthly']));
			$('#transactions').html(getTable(['Name', 'Amount', 'Year', 'Month'], ['name', 'amount', 'year', 'month'], result['one_time']));
		}
	});
}

var getTable = function(headers, props, data)
{
	var $table = $('<table />');
	for(var i = 0; i < headers.length; i++)
	{
		var header = headers[i];
		$table.append('<th>' + header + '</th>');
	}
	$.each(data, function(index, value) {
		var $row = $('<tr />');
		for(var i = 0; i < props.length; i++)
		{
			var prop = props[i];
			var val = value.hasOwnProperty(prop)? value[prop]: "Property Nonexistant";
			var $cell = $('<td>' + val + '</td>');
			$row.append($cell);
		}
		$table.append($row);
	});
	return $table;
};

var changeDateSelector = function()
{
	if($('#checkbox_monthly').is(':checked'))
	{
		$('.monthly_options').hide();
	}
	else
	{
		$('.monthly_options').show();
	}
}