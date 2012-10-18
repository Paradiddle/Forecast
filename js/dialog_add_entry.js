var selected = "";

function click_AddEntry()
{
	if(!validator.form())
	{
		console.log("Form not validated.");
		return false;
	}
	
	var type = getAddEntryType();
	var name = getAddEntryName();
	var is_monthly = getAddEntryIsMonthly();
	var	month = getAddEntryMonth();
	var	year = getAddEntryYear();
	var	amount = parseInt(getAddEntryAmount());
	
	if(amount == "NaN")
		return false;
	
	if (type == "Expense")
		amount = -Math.abs(amount);
	if (type == "Income")
		amount = Math.abs(amount);
	
	addEntry(name, amount, is_monthly, year, month);

	clearAddEntryNameAndAmount();
	
	hideEntryDialog();
	refreshEntries(); 
	return false;
}

function getAddEntryType()
{
	return $('[name=entry_type]:checked').attr('title');	
}

function getAddEntryName()
{
	return $('[name=input_name]').val();
}

function getAddEntryIsMonthly()
{
	return $('[name=monthly]:checked').val() == "True";
}

function getAddEntryMonth()
{
	return $('[name=selectorMonth]').val();
}

function getAddEntryYear()
{
	return $('[name=selectorYear]').val();	
}

function getAddEntryAmount()
{
	return $('[name=input_amount]').val();	
}

function getEntryDialog()
{
	return $('#add_dialog_div');
}

function clearAddEntryNameAndAmount()
{
	$('#input_name').val('');
	$('#input_amount').val('');	
}

function hideEntryDialog()
{
	selected = "";
	getEntryDialog().hide();
}

function showEntryDialog()
{
	getEntryDialog().show();
	hideEditEntryDialog();
	validator.resetForm();
	$('#input_name').focus();
	$('#input_name').select();
}

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