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

function getEditedStartBalance($form)
{
	var $input = $form.find('#startBalanceInput');
	var val = $input.val();
	var new_start_bal = parseInt(val);
	return new_start_bal;
}

function updateStartBalanceLabel($form, val)
{
	var $label = $form.find('#startBalanceLabel');
	$label.html(formatDollars(val, '--'));
}

function hideStartBalanceInput($form)
{
	var $input = $(event.target).find('#startBalanceInput');
	var $label = $form.find('#startBalanceLabel');
	$input.hide();
	$label.show();
}

function showStartBalanceInput($form)
{
	var $input = $form.find('#startBalanceInput');
	var $label = $form.find('#startBalanceLabel');
	
	$('.start_balance_input').hide();
	$('.start_balance_label').show();
	
	$label.hide();
	$input.show();
	$input.val($label.html().replace('$', ''));
	$input.focus();
	$input.select();
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
	
	updateMonthFilterIndexes();
}

//Custom JQuery Validators
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
		var lst = one_time.where({'name': value});
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

function setEntriesHtml(html)
{
	$('#entries').html(html);	
}

function renderMonthlyEntries()
{
	$('#monthly_entries').html(render_template('monthly_entries', monthly.toArray()));	
}

function postRenderMonthModules()
{
	$('.editable_entry').hover(
		function() {
			$(this).find('.show_on_hover').show();
		},
		function() {
			$(this).find('.show_on_hover').hide();
		}
	);
	
	// Hide start balance inputs
	$('.start_balance_input').hide();
	
	// Hide the buttons
	$('.show_on_hover').hide();	
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