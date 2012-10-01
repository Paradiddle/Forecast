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
	$.post("", data, function(result) {$("#monthly_transactions").html(result);});
}

var updateTransactions = function()
{
	var data = 
	{
		year: $('#idYearSelector').val()
	};
	$.post("/Transactions", data, function(result) {$("#transactions").html(result);});
}

var showDateSelector = function()
{
	$('#year_selector').show();
	$('#month_selector').show();
}

var hideDateSelector = function()
{
	$('#year_selector').hide();
	$('#month_selector').hide();
}