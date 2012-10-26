function initialElementSetup()
{	
	// Setup the popup dialogs
	getEntryDialog().hide();
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
	
	$('.to_show_on_hover').hide();
	
	//Hide the sort div
	$('.sort').hide();
}

function openEditMonthlyModifications(year, month)
{
	var data = {
		month: month,
		year: year
	};
	var mods = modifications.where({'month':month, 'year':year});
	mods = _.sortBy(mods, function (model)
	{
		return model.get("name");
	});
	data.modifications = mods;
	if(data.modifications.length > 0)
	{
		getMonthlyModificationsDialog().attr('title', "Monthly Modifications for " + month + " of " + year);
	}
	else
	{
		getMonthlyModificationsDialog().attr('title', "No Monthly Modifications for " + month + " of " + year);
	}
	getMonthlyModificationsDialog().html(render_template("popup_monthly_modifications", data));
	getMonthlyModificationsDialog().data('year', year);
	getMonthlyModificationsDialog().data('month', month);
	getMonthlyModificationsDialog().dialog("open");
	$('.smallButton').blur();
}

function click_DeleteMonthlyMod(target)
{
	var year = getMonthlyModificationsDialog().data('year');
	var month = getMonthlyModificationsDialog().data('month');
	var entryName = ($(target).parents(".monthly_mod")).attr('name');
	var delmatches = modifications.where({'month':month, 'year':year, 'name':entryName});
	if (delmatches.length == 1)
		modifications.remove(delmatches[0]);
	refreshEntries();
	openEditMonthlyModifications(year, month);
}

function getMonthlyModificationsDialog()
{
	return $('#div_monthly_modifications');
}

var colorPickers = {};

function showMonthlyConfigurationDialog()
{
	getMonthlyConfigurationDialog().html(render_template('popup_monthly_configuration', monthly));
	populateMonthYearSelectElements(getMonthlyConfigurationDialog());
	$('.color_input').each(function(index, val) {
		var $el = $(val);
		var $row = $el.parents('.monthly_entry');
		var cid = $row.attr('name');
		var model = monthly.getByCid(cid);
		var picker = colorPickers[cid];
		
		var track = model.get('track');
		if(typeof track != "undefined")
		{
			$row.find('.month_select').val(track.month);
			$row.find('.year_select').val(track.year);
			$row.find('#track_start_balance').val(track.amount);
		}
		
		if(typeof picker != "undefined")
		{
			delete colorPickers[cid];
		}
		picker = new jscolor.color(val);
		colorChange({'target':val});
		colorPickers[cid] = picker;
	});
	getMonthlyConfigurationDialog().dialog("open");
	
	for(var prop in colorPickers)
	{
		var pick = colorPickers[prop];
		pick.hidePicker();
	}
	
	$('#apply_button').focus();
}

function colorChange(evt) {
	var $picker = $(evt.target);
	var $name = $picker.parents('.monthly_entry').find('#name_div');
	$name.css('color', $picker.css('background-color'));
}

function getMonthlyConfigurationDialog()
{
	return $('#div_monthly_configuration');
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
	var $input = $form.find('#startBalanceInput');
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
	for(var i = curDate.getFullYear() - 1; i <= curDate.getFullYear() + 2; i++)
	{
		years.push("" + i);
	}
	
	populateMonthYearSelectElements();
	
	populateSelector($(idDropdownNumCols), NUM_COLS);

	updateDropdownSelections();
	
	updateMonthFilterIndexes();
}

function updateDropdownSelections()
{
	// From year set to current year, to year set to next year
	// From and to months set to current month
	$(idDropdownFromYear).val(useDefined(years[settings['fromYear']], curDate.getFullYear()));
	$(idDropdownFromMonth).val(useDefined(months[settings['fromMonth']], months[curDate.getMonth()]));
	$(idDropdownToMonth).val(useDefined(months[settings['toMonth']], months[(curDate.getMonth() - 1) % 12]));
	$(idDropdownToYear).val(useDefined(years[settings['toYear']], curDate.getFullYear() + 1));
}

function populateMonthYearSelectElements($filter)
{
	var monthFiller = getSelectFiller(months);
	var yearFiller = getSelectFiller(years);
	
	var yearFilter = $('.year_select');
	var monthFilter = $('.month_select');
	if(typeof $filter != "undefined")
	{
		yearFilter = $filter.find(yearFilter);
		monthFilter = $filter.find(monthFilter);
	}
	
	yearFilter.each(yearFiller);
	monthFilter.each(monthFiller);
}

function getSelectFiller(array)
{
	return function(index, el) {populateSelector($(el), array)};
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

function validateColorConfigurations()
{
	var $dialog = getMonthlyConfigurationDialog();
	var allGood = true;
	$dialog.find('.color_input').each(function (index, value)
	{
		var $val = $(value);
		var $row = $val.parents('.monthly_entry');
		var cid = $row.attr('name');
		var good = /^#[0-9A-F]{3,6}$/.test($val.val());
		if (!good)
		{
			$val.addClass('error');
			allGood = false;
		}
		else
		{
			$val.removeClass('error');
			$val.find('.' + cid).css('background-color', $val.val());
			monthly.getByCid(cid).set('color', $val.val());
		}
		
		var model = monthly.getByCid(cid);
		var track = $row.find('.track_checkbox').prop('checked');
		if(track)
		{
			var startMonth = $row.find('.month_select').val();
			var startYear = $row.find('.year_select').val();
			var monthIndex = $row.find('.month_select option:selected').index();
			var yearIndex = $row.find('.year_select option:selected').index();
			var startAmount = $row.find('#track_start_balance').val();
			var track = {
				'month': startMonth,
				'year': startYear,
				'monthIndex': monthIndex,
				'yearIndex': yearIndex,
				'amount': parseInt(startAmount)
			};
			model.set('track', track);
		}
		else
		{
			model.unset('track');
		}
		
	});
	return allGood;
}

function applyColorConfigurations()
{
	var validated = validateColorConfigurations();
	if(validated)
	{
		getMonthlyConfigurationDialog().dialog("close");
		refreshEntries();
	}
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

function addShare()
{
	var email = $('#share_input').val();
	$('#share_input').val('');
	addShareServer(email);
}

function deleteShare(event)
{
	var email = $(event.target).parents('.share_row').attr('name');
	removeShareServer(email);
}

function setEntriesHtml(html)
{
	$('#entries').html(html);	
}

function switchToShare(event)
{
	var email = $(event.target).parents('.share_row').attr('name');
	retrieveParseRefreshEntries(email);
	$('#tabs').tabs('select', 0);
}

function switchBack()
{
	retrieveParseRefreshEntries();
}

function refreshSharedWith()
{
	var data = {};
	data.sharing_with = sharing_with;
	data.shared = shared;
	$('#share_entries').html(render_template('table_shares', data));
	$('.to_show_on_hover').hide();
}

function renderMonthlyEntries()
{
	$('#monthly_entries').html(render_template('monthly_entries', sortByIncomeThenAmount(monthly.toArray())));	
}

function postRenderMonthModules()
{
	// Hide start balance inputs
	$('.start_balance_input').hide();
	
	// Hide the buttons
	$('.to_show_on_hover').hide();
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
	$('.sort').slideToggle('fast');
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