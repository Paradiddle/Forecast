var edit_selected = "";

function getEditEntryDialog()
{
	return $('#edit_entry_div');
}

function hideEditEntryDialog(fade)
{
	edit_selected = "";
	getEditEntryDialog().data('model', undefined);
	getEditEntryDialog().data('year', undefined);
	getEditEntryDialog().data('month', undefined);
	
	if(typeof fade == "undefined" || !fade)
		getEditEntryDialog().hide();
	else
		getEditEntryDialog().fadeOut('fast');
	$('.entry_data').removeClass('editing');
}

function showEditEntryDialog(fade)
{
	if(typeof fade == "undefined" || !fade)
		getEditEntryDialog().show();
	else
		getEditEntryDialog().fadeIn('fast');
	hideEntryDialog(true);
}

function showEditEntryDialogUnderEntry($button, model, year, month, is_delete)
{
	$('.entry_data').removeClass('editing');
	$('.edit').toggle(!is_delete);
	$('.delete').toggle(is_delete);
	var $status = $('#edit_dialog_status');
	var $actiontd = $('.edit_action');
	var action = is_delete? "Delete": "Edit";

	var $option_one = $('<input type="radio" name="scope" value="this">Only this</input>');
	$actiontd.html($option_one);
	$option_one.prop('checked', 'checked');
	
	if(model.get('monthly'))
	{
		$status.html(action + ' Monthly Entry \'' + model.get('name') + '\'');
		
		//var $option_two = $('<input type="radio" name="scope" value="future">This & future</input>');
		var $option_three = $('<input type="radio" name="scope" value="all">All</input>');
		
		//$actiontd.append("<br>");
		//$actiontd.append($option_two);
		$actiontd.append("<br>");
		$actiontd.append($option_three);
	}
	else
	{
		$status.html(action + ' One Time Entry \'' + model.get('name') + '\'');
	}
	
	var $dialog = $('#edit_entry_div');
	var key = action + year + ":" + month + ":" + model.get('name') + ":" + model.get('monthly');
	if (edit_selected == key)
	{
		edit_selected = "";
		hideEditEntryDialog(true);
		return;
	}
	offsetElementFrom($dialog, $button, true);
	if(edit_selected != "")
		hideEditEntryDialog(false);
	showEditEntryDialog(true);
	
	if(!is_delete)
	{
		$('#edit_input_name').prop('disabled', 'disabled');
		$('#edit_input_name').val(model.get('name'));
		$('#edit_input_amount').val(Math.abs(model.get('amount')));
		$('#edit_input_amount').focus();
		$('#edit_input_amount').select();
		if(model.get('amount') > 0)
			$('#edit_entry_income').prop('checked', 'checked');
		else
			$('#edit_entry_expense').prop('checked', 'checked');
	}
	
	$dialog.data('model', model);
	$dialog.data('year', year);
	$dialog.data('month', month);

	$button.parents('.entry_data').addClass('editing');
	edit_selected = key;
}

function applyEdit()
{
	var $dialog = $('#edit_entry_div');
	var scope = $('input[name=scope]:checked').val();
	var model = $dialog.data('model');
	var year = $dialog.data('year');
	var month = $dialog.data('month');

	var amount = parseInt($('#edit_input_amount').val());
	var type = $('input[name=edit_entry_type]:checked').val();
	if(type == "Income")
		amount = Math.abs(amount);
	else
		amount = -Math.abs(amount);
	
	if(model.get('amount') == amount && scope != "all")
	{
		hideEditEntryDialog();
		return;
	}
	
	if(model.get('monthly'))
	{
		if(scope == "all")
		{
			model.set('amount', amount);
			model.unset('modifications');
		}
		else if(scope == "this")
		{
			adjustMonthly(year, month, model.get('name'), amount);
		}
	}
	else
	{
		model.set('amount', amount);
	}

	hideEditEntryDialog();
	refreshEntries();	
}

function applyDelete()
{
	var $dialog = $('#edit_entry_div');
	var scope = $('input[name=scope]:checked').val();
	var model = $dialog.data('model');
	var year = $dialog.data('year');
	var month = $dialog.data('month');

	if(model.get('monthly'))
	{
		if(scope == "all")
		{
			monthly.remove(model);
		}
		else if(scope == "this")
		{
			deleteMonthly(year, month, model.get('name'));
		}
	}
	else
	{
		one_time.remove(model);
	}

	hideEditEntryDialog();
	refreshEntries();	
}