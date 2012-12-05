$(document).ready(function()
{
	_.templateSettings.variable = "data";

	// Setup and initialize custom validation for the entry dialog, ensuring things like only numbers are entered
	// into the amount box, etc.
	jQueryHelpers.initializeValidation();

	// Setup the initial state of the elements, hide the popups, etc.
	jQueryHelpers.initialElementSetup();

	$('.dirtyfilter').on("change", jQueryHelpers.onDateFilterChanged);

	// Show hide things on hover (edit/delete buttons on each entry)
	$('body').delegate('.show_on_hover', "hover", jQueryHelpers.onHoverOverHoverable);

	$('body').delegate('.color_input', 'change', jQueryHelpers.colorChange);

	server.retrieveParseRefreshEntries();
});

var app = (function() {
	var pub = {};

	// Object that holds settings
	pub.settings = {};

	// A string that represents whether or not you are viewing someone else's budget.
	// undefined if you are viewing your own, set to email address of other account when viewing another.
	pub.viewing_other = undefined;

	pub.monthModuleViews = {};

	pub.dirtyFilter = true;

	pub.idDropdownToMonth = '#to_month';
	pub.idDropdownToYear = '#to_year';
	pub.idDropdownFromMonth = '#from_month';
	pub.idDropdownFromYear = '#from_year';

	pub.idDropdownNumCols = '#num_cols';
	pub.validator = undefined;
	pub.edit_validator = undefined;

	pub.loaded = false;

	pub.curDate = new Date();

	// populated statically
	pub.years = [];
	pub.months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

	// TODO Static options for
	pub.NUM_COLS = [ 2, 3, 4 ];

	// Collection representing all the monthly entries, one Model per monthly entry
	pub.monthly = undefined;

	// Collection representing all the one_time entries, one Model per entry
	pub.one_time = undefined;

	pub.monthData = undefined;

	// Collection of metadata associated with each month, one Model per month
	pub.monthsMeta = undefined;

	// Collection of monthly modifications
	pub.modifications = undefined;

	// Array of e-mails you're sharing your budget with
	pub.sharing_with = undefined;

	// Array of e-mails sharing their budget with you
	pub.shared = undefined;

	pub.getSettings = function()
	{
		return settings;
	};

	pub.refreshEntries = function ()
	{
		var valid = app.validateFilter();
		if (!valid)
		{
			alert("Not a valid to and from filter.");
			jQueryHelpers.updateDropdownSelections();
			return;
		}

		app.calculateAllMonthData();
		if (app.dirtyFilter)
		{
			app.updateYearMonthIterator();
			var data = app.getEntriesTableTemplateData();
			jQueryHelpers.setEntriesHtml(server.render_template('entries_table', data));
		}

		dataViews.recalculateAndRenderMonthModules();
		jQueryHelpers.renderMonthlyEntries();

		app.dirtyFilter = false;

		$('.modify_data').toggle(app.viewing_other == undefined);
		jQueryHelpers.postRenderMonthModules();
		if (typeof app.viewing_other == "undefined")
		{
			$('#budget_name').hide();
			$('#budget_return').hide();
		}
		else
		{
			$('#budget_name').show();
			$('#budget_name').html("Viewing budget for '" + app.viewing_other + "'");
			$('#budget_return').show();
		}
	};

	pub.updateMonthFilterIndexes = function ()
	{
		pub.settings.toMonth = jQueryHelpers.getSelectedIndex(pub.idDropdownToMonth);
		pub.settings.fromMonth = jQueryHelpers.getSelectedIndex(pub.idDropdownFromMonth);
		pub.settings.toYear = jQueryHelpers.getSelectedIndex(pub.idDropdownToYear);
		pub.settings.fromYear = jQueryHelpers.getSelectedIndex(pub.idDropdownFromYear);
	};

	pub.updateStartBalance = function (year, month, val)
	{
		var m = app.monthsMeta.get(pub.months_meta_key(year, month));
		m.set('start_balance', val);
	};

	pub.sortByIncomeThenAmount = function (models, year, month)
	{
		// Group by expense and income
		var groups = _.groupBy(models, function (value)
		{
			return value.get('amount') < 0;
		});
		// Sort both expenses and income by amount
		for (var key in groups)
		{
			if (groups.hasOwnProperty(key))
			{
				groups[key] = _.sortBy(groups[key], function (value)
				{
					var amount;
					if (typeof year == "undefined" || typeof month == "undefined")
						amount = value.get('amount');
					else
						amount = pub.getModifiedAmount(value, year, month);
					return -Math.abs(amount);
				});
			}
		}

		// Populate our new list of entries in the order of Income followed by Expenses
		var arr = [];
		if (groups['false'] != undefined)
			arr = arr.concat(groups['false']);
		if (groups['true'] != undefined)
			arr = arr.concat(groups['true']);
		return arr;
	};

	pub.useDefined = function (var1, var2)
	{
		if (typeof var1 == "undefined")
			return var2;
		return var1;
	};

	pub.formatDollars = function (num, undefinedFallback, showpositive)
	{
		if (typeof showpositive == "undefined")
			showpositive = false;
		if (typeof num == "undefined")
			return undefinedFallback;
		if (num < 0)
			return "-$" + Math.abs(num);
		if (showpositive)
			return "+$" + num;
		return "$" + num;
	};

	pub.getModifiedAmount = function (model, year, month)
	{
		var id = year + ":" + month + ":" + model.get('name');
		var mod = app.modifications.get(id);
		if (typeof mod == "undefined")
		{
			return model.get('amount');
		}
		return mod.get('amount');
	};

	pub.getNextMonthMeta = function (yearIndex, monthIndex)
	{
		var year = parseInt(pub.years[yearIndex]);
		if (monthIndex < pub.months.length - 1)
			monthIndex++;
		else
		{
			monthIndex = 0;
			year++;
		}
		return "" + year + ":" + pub.months[monthIndex];
	};

	pub.getPreviousMonthMeta = function (yearIndex, monthIndex)
	{
		var year = parseInt(pub.years[yearIndex]);
		if (monthIndex > 0)
			monthIndex--;
		else
		{
			monthIndex = pub.months.length - 1;
			year--;
		}
		return "" + year + ":" + pub.months[monthIndex];
	};

	pub.deleteMonthly = function (year, month, name)
	{
		pub.putMonthlyModification(year, month, name, undefined);
	};

	pub.adjustMonthly = function (year, month, name, amount)
	{
		pub.putMonthlyModification(year, month, name, amount);
	};

	pub.putMonthlyModification = function (year, month, name, amount)
	{
		var id = year + ":" + month + ":" + name;
		var mod = app.modifications.get(id);
		if (typeof mod == "undefined")
		{
			mod = new Backbone.Model();
			mod.set('year', year);
			mod.set('month', month);
			mod.set('name', name);
			mod.set('id', id);
			app.modifications.add(mod);
		}
		mod.set('amount', amount);
	};

	pub.onReceiveJsonEntries = function (jsonData)
	{
		pub.parseData(jsonData);
		pub.loadSettings();
		app.loaded = true;
		app.viewing_other = jsonData['viewing_other'];
		pub.refreshEntries();
		jQueryHelpers.refreshSharedWith();
	};

	pub.loadSettings = function ()
	{
		jQueryHelpers.populateSelectElements();
	};

	pub.getEntriesArrayForYearMonth = function (year, month)
	{
		var one_times = app.one_time.where({'year':year, 'month':month});
		return one_times.concat(app.monthly.toArray());
	};

	pub.one_time_key = function (year, month, name)
	{
		return "" + year + ":" + month + ":" + name;
	};

	pub.deleteEmail = function (email)
	{
		app.sharing_with.splice(app.sharing_with.indexOf(email), 1);
	};

	pub.months_meta_key = function (year, month)
	{
		return year + ":" + month;
	};

	pub.parseData = function (data)
	{
		app.monthly = new Backbone.Collection(data['monthly']);
		app.one_time = new Backbone.Collection(data['one_time']);
		app.monthsMeta = new Backbone.Collection(data['months']);
		app.modifications = new Backbone.Collection(data['modifications']);
		app.sharing_with = data['sharing_with'];
		app.shared = data['shared'];
		settings = data['settings'];
	};

	pub.getOnlyRelevantPartsOfMonths = function ()
	{
		return app.monthsMeta.map(function (value)
		{
			var sbal = value.get('start_balance');
			if (typeof sbal != "undefined")
			{
				return {id:value.id, start_balance:sbal};
			}
			return null;
		});
	};

	var yearMonthIteratorData;

	pub.getYearMonthIteratorData = function ()
	{
		return yearMonthIteratorData;
	};

	pub.updateYearMonthIterator = function ()
	{
		yearMonthIteratorData = [];

		// Iterate through each year from the starting year to the ending year
		for (var currentYearNum = settings.fromYear; currentYearNum <= settings.toYear; currentYearNum++)
		{
			// If the current year is the first year of the selection then the starting
			// month will be the selected starting month, otherwise we start at January.
			var startingMonthNum = (currentYearNum == settings.fromYear) ? settings.fromMonth : 0;

			// If the current year is the last year of the selection then the ending
			// month will be the selected ending month, otherwise we end at December.
			var endingMonthNum = (currentYearNum == settings.toYear) ? settings.toMonth : 11;

			for (var currentMonthNum = startingMonthNum; currentMonthNum <= endingMonthNum; currentMonthNum++)
			{
				var currentMonthStr = pub.months[currentMonthNum];
				var currentYearStr = pub.years[currentYearNum];
				var obj = {
					month:currentMonthStr,
					year:currentYearStr,
					month_num:currentMonthNum,
					year_num:currentYearNum,
					meta:app.monthsMeta.get(currentYearStr + ":" + currentMonthStr)
				};
				yearMonthIteratorData.push(obj);
			}
		}
	};

	pub.getEntriesTableTemplateData = function ()
	{
		var templateData = {};
		templateData.rowData = [];
		var numCols = pub.NUM_COLS[jQueryHelpers.getNumCols()];

		var rowMonthsData = [];
		var curIndex = 0;

		for (var j = 0; j < yearMonthIteratorData.length; j++)
		{
			var month = yearMonthIteratorData[j];

			app.monthData = {};
			app.monthData.month = month.month;
			app.monthData.year = month.year;

			curIndex++;
			rowMonthsData.push(app.monthData);
			if (curIndex == numCols || month.month == "December")
			{
				curIndex = 0;
				templateData.rowData.push(rowMonthsData);
				rowMonthsData = [];
			}
		}
		if (rowMonthsData.length > 0)
			templateData.rowData.push(rowMonthsData);

		return templateData;
	};

	pub.calculateAllMonthData = function ()
	{
		var tracked = app.monthly.filter(function (value)
		{
			return typeof value.get('track') != "undefined";
		});

		var tracked_balances = {};

		var track = undefined;

		for (var i = 0; i < tracked.length; i++)
		{
			track = tracked[i];
			tracked_balances[track.get('name')] = 0;
		}

		for (var y = 0; y < pub.years.length; y++)
		{
			var yearString = pub.years[y];
			for (var m = 0; m < pub.months.length; m++)
			{
				var monthString = pub.months[m];
				var id = yearString + ":" + monthString;
				var meta = app.monthsMeta.get(id);
				if (typeof meta == 'undefined')
				{
					meta = new Backbone.Model();
					meta.set('id', id);
					app.monthsMeta.add(meta);
				}

				var entries = pub.getEntriesArrayForYearMonth(yearString, monthString);
				var total_expenses = 0;
				var total_income = 0;
				for (var e = 0; e < entries.length; e++)
				{
					var entry = entries[e];
					var name = entry.get('name');
					var amount = pub.getModifiedAmount(entry, yearString, monthString);
					if (typeof amount == "undefined")
						continue;

					if (_.indexOf(tracked, entry) != -1)
					{
						track = entry.get('track');
						if (y == track.yearIndex && m == track.monthIndex)
						{
							tracked_balances[name] = track.amount + amount;
						}
						else if (y > track.yearIndex || (y == track.yearIndex && m >= track.monthIndex))
						{
							tracked_balances[name] += amount;
						}
					}
					else
					{
						if (amount > 0)
							total_income += amount;
						else
							total_expenses += amount;
					}
				}
				var diff = total_income + total_expenses;
				var start_balance = meta.get('start_balance');
				var prevMonthMeta = app.monthsMeta.get(pub.getPreviousMonthMeta(y, m));
				var prevEstEndBalance = undefined;
				if (typeof prevMonthMeta != "undefined")
				{
					prevEstEndBalance = prevMonthMeta.get('est_end_balance');
				}
				if (start_balance != undefined)
				{
					meta.set('est_end_balance', start_balance + diff);
					if (prevMonthMeta != undefined && prevEstEndBalance != undefined)
					{
						var disc = start_balance - prevEstEndBalance;
						prevMonthMeta.set('discrepancy', disc);
					}
				}
				else
				{
					if (prevMonthMeta != undefined)
					{
						if (prevEstEndBalance != undefined)
						{
							meta.set('est_start_balance', prevEstEndBalance);
							meta.set('est_end_balance', prevEstEndBalance + diff);
						}
					}
				}

				meta.set('total_income', total_income);
				meta.set('total_expenses', total_expenses);

				var tb = _.clone(tracked_balances);
				if (typeof tb == "undefined")
					tb = {};
				meta.set('tracked_balances', tb);
				meta.set('difference', diff);
				meta.set('next_month', pub.getNextMonthMeta(y, m));
				meta.set('prev_month', pub.getPreviousMonthMeta(y, m));
			}
		}
	};

	pub.validateFilter = function ()
	{
		return jQueryHelpers.getSelectedIndex(pub.idDropdownFromYear) <= jQueryHelpers.getSelectedIndex(pub.idDropdownToYear)
				&& (jQueryHelpers.getSelectedIndex(pub.idDropdownFromMonth) <= jQueryHelpers.getSelectedIndex(pub.idDropdownToMonth) || jQueryHelpers.getSelectedIndex(pub.idDropdownFromYear) < jQueryHelpers.getSelectedIndex(pub.idDropdownToYear));
	};

	pub.addEntry = function (name, amount, is_monthly, year, month)
	{
		var data = {
			name:name,
			amount:amount,
			monthly:is_monthly,
			year:year,
			month:month
		};

		var model = undefined;
		var key = undefined;

		if (is_monthly)
		{
			key = name;
			model = app.monthly.get(key);

			if (typeof model != "undefined")
				return false;

			delete data.month;
			delete data.year;
			model = new Backbone.Model(data);
			model.set('color', '#000000');
			model.set('id', key);
			app.monthly.add(model);
		}
		else
		{
			key = pub.one_time_key(year, month, name);
			model = app.one_time.get(key);

			if (typeof model != "undefined")
				return false;

			model = new Backbone.Model(data);
			model.set('id', key);
			app.one_time.add(model);
		}
		return true;
	};

	return pub;
})();

var dataViews = (function() {
	var pub = {};

	pub.click_EditMonthlies = function ()
	{
		jQueryHelpers.openEditMonthlyModifications(this.year, this.month);
	};

	pub.calculate_MonthModule = function ()
	{
		this.data.total_expenses = this.meta.get('total_expenses');
		this.data.total_income = this.meta.get('total_income');
		this.data.entries = app.sortByIncomeThenAmount(app.getEntriesArrayForYearMonth(this.year, this.month), this.year, this.month);
		this.data.end_balance = this.meta.get('est_end_balance');
		this.data.tracked_balances = this.meta.get('tracked_balances');
		this.data.meta = this.meta;
		this.data.hasModifications = app.modifications.where({year:this.year, month:this.month}).length > 0;
		var currentStartBalance = this.meta.get('start_balance');
		if (currentStartBalance != undefined)
			this.data.start_balance = currentStartBalance;
		else
			this.data.start_balance = this.meta.get('est_start_balance');
		this.data.discrepancy = this.meta.get('discrepancy');
	};

	pub.render_MonthModule = function ()
	{
		$(this.el).html(server.render_template('month_module', this.data));
		return this;
	};

	pub.click_EditEntry = function (event)
	{
		var entryName = ($(event.target).parents(".entry_data")).attr('name');
		dialogEditEntry.showEditEntryDialogUnderEntry($(event.target), this.data.entries[entryName], this.year, this.month, false);
	};

	pub.click_DeleteEntry = function (event)
	{
		var entryName = ($(event.target).parents(".entry_data")).attr('name');
		dialogEditEntry.showEditEntryDialogUnderEntry($(event.target), this.data.entries[entryName], this.year, this.month, true);
	};

	pub.click_AddButton = function (event)
	{
		dialogAddEntry.showEntryDialogUnderYearMonth($(event.target), this.year, this.month);
	};

	pub.submit_StartBalanceForm = function (event)
	{
		var $form = $(event.target);
		var newStartBalance = jQueryHelpers.getEditedStartBalance($form);
		jQueryHelpers.hideStartBalanceInput($form);
		app.updateStartBalance(this.year, this.month, newStartBalance);
		jQueryHelpers.updateStartBalanceLabel($form, newStartBalance);
		app.refreshEntries();
		return false;
	};

	pub.click_StartBalanceLabel = function (event)
	{
		var $form = $(event.target).parents('#startBalanceForm');
		jQueryHelpers.showStartBalanceInput($form);
	};

	pub.recalculateAndRenderMonthModules = function ()
	{
		for (var j = 0; j < app.getYearMonthIteratorData().length; j++)
		{
			var month = app.getYearMonthIteratorData()[j];
			var key = month.year + ":" + month.month;
			var module = app.monthModuleViews[key];
			var meta = app.monthsMeta.get(month.year + ":" + month.month);
			var $stuff = $('.' + month.month).filter('.' + month.year);
			if (typeof module == "undefined")
			{
				module = new pub.MonthModule({
					el:$stuff
				});
				app.monthModuleViews[key] = module;
			}
			if (app.dirtyFilter)
			{
				module.el = $stuff;
				module.$el = $stuff;
				module.delegateEvents();
			}
			module.update(month.year, month.month, meta);
			module.render();
		}
	};

	return pub;
})();

dataViews.MonthModule = Backbone.View.extend({
	update:function (year, month, meta)
	{
		this.year = year;
		this.month = month;
		this.meta = meta;
		this.data = {
			year:year,
			month:month,
			shortYear:year.substr(2, 3),
			shortMonth:month.substr(0, 3)
		};
		this.calculate();
	},
	calculate:dataViews.calculate_MonthModule,
	events:{
		"click #addButton":dataViews.click_AddButton,
		"click #startBalanceLabel":dataViews.click_StartBalanceLabel,
		"submit #startBalanceForm":dataViews.submit_StartBalanceForm,
		"click #editButton":dataViews.click_EditEntry,
		"click #deleteButton":dataViews.click_DeleteEntry,
		"click #editMonthlies":dataViews.click_EditMonthlies
	},
	render:dataViews.render_MonthModule
});

var dialogAddEntry = (function() {
	var selected = "";

	var pub = {};

	pub.click_AddEntry = function ()
	{
		if (!app.validator.form())
		{
			console.log("Form not validated.");
			return false;
		}

		var type = this.getAddEntryType();
		var name = this.getAddEntryName();
		var is_monthly = this.getAddEntryIsMonthly();
		var month = this.getAddEntryMonth();
		var year = this.getAddEntryYear();
		var amount = parseInt(this.getAddEntryAmount());

		if (amount == "NaN")
			return false;

		if (type == "Expense")
			amount = -Math.abs(amount);
		if (type == "Income")
			amount = Math.abs(amount);

		app.addEntry(name, amount, is_monthly, year, month);

		this.clearAddEntryNameAndAmount();

		this.hideEntryDialog();
		app.refreshEntries();
		return false;
	};

	pub.getAddEntryType = function ()
	{
		return $('[name=entry_type]:checked').attr('title');
	};

	pub.getAddEntryName = function ()
	{
		return $('[name=input_name]').val();
	};

	pub.getAddEntryIsMonthly = function ()
	{
		return $('[name=monthly]:checked').val() == "True";
	};

	pub.getAddEntryMonth = function ()
	{
		return $('[name=selectorMonth]').val();
	};

	pub.getAddEntryYear = function ()
	{
		return $('[name=selectorYear]').val();
	};

	pub.getAddEntryAmount = function ()
	{
		return $('[name=input_amount]').val();
	};

	pub.getEntryDialog = function ()
	{
		return $('#add_dialog_div');
	};

	pub.clearAddEntryNameAndAmount = function ()
	{
		$('#input_name').val('');
		$('#input_amount').val('');
	};

	pub.hideEntryDialog = function (fade)
	{
		selected = "";
		if (typeof fade == "undefined" || !fade)
			this.getEntryDialog().hide();
		else
			this.getEntryDialog().fadeOut('fast');
	};

	pub.showEntryDialog = function (fade)
	{
		if (typeof fade == "undefined" || !fade)
			this.getEntryDialog().show();
		else
			this.getEntryDialog().fadeIn('fast');
		dialogEditEntry.hideEditEntryDialog(true);
		app.validator.resetForm();
		$('#input_name').focus();
		$('#input_name').select();
	};

	pub.showEntryDialogUnderMonthly = function (el)
	{
		if (selected == "monthly")
		{
			selected = "";
			this.hideEntryDialog(true);
			jQueryHelpers.populateMonthYearSelectElements(dialogAddEntry.getEntryDialog());
			return;
		}
		if (selected != "")
			this.hideEntryDialog();
		selected = "monthly";
		dialogAddEntry.updateEntryDialog('Add Monthly Entry', true, $(el), true, false);
	};

	pub.showEntryDialogUnderEntryHeader = function (el)
	{
		if (selected == "transactions")
		{
			selected = "";
			this.hideEntryDialog(true);
			return;
		}
		if (selected != "")
			this.hideEntryDialog();
		selected = "transactions";
		this.updateEntryDialog('Add Entry', false, $(el), false, false);
	};

	pub.showEntryDialogUnderYearMonth = function ($button, year, month)
	{
		var key = year + ":" + month;
		if (selected == key)
		{
			selected = "";
			this.hideEntryDialog(true);
			return;
		}
		if (selected != "")
			this.hideEntryDialog();
		selected = key;
		var status = 'Add Entry for ' + month + " " + year;
		this.updateEntryDialog(status, false, $button, true, year, month, true);
	};

	pub.updateEntryDialog = function (statusText, checkMonthlyCheckbox, $moveTo, hideMonthOption, yearSelection, monthSelection, topLeft)
	{
		$('#dialog_status').html(statusText);
		if (checkMonthlyCheckbox)
			$('#checkbox_monthly').attr('checked', 'checked');
		else
			$('#checkbox_monthly').removeAttr("checked");

		jQueryHelpers.changeDateSelector();

		if (yearSelection !== undefined)
			$('#selectorYear').val(yearSelection);

		if (monthSelection !== undefined)
			$('#selectorMonth').val(monthSelection);

		$('.month_option').toggle(!hideMonthOption);

		jQueryHelpers.offsetElementFrom(dialogAddEntry.getEntryDialog(), $moveTo, topLeft);
		this.showEntryDialog(true);
	};

	return pub;
})();


var dialogEditEntry = (function() {
	var pub = {};

	var edit_selected = "";

	pub.getEditEntryDialog = function ()
	{
		return $('#edit_entry_div');
	};

	pub.hideEditEntryDialog = function (fade)
	{
		edit_selected = "";
		pub.getEditEntryDialog().data('model', undefined);
		pub.getEditEntryDialog().data('year', undefined);
		pub.getEditEntryDialog().data('month', undefined);

		if (typeof fade == "undefined" || !fade)
			pub.getEditEntryDialog().hide();
		else
			pub.getEditEntryDialog().fadeOut('fast');
		$('.entry_data').removeClass('editing');
	};

	pub.showEditEntryDialog = function (fade)
	{
		if (typeof fade == "undefined" || !fade)
			pub.getEditEntryDialog().show();
		else
			pub.getEditEntryDialog().fadeIn('fast');
		dialogAddEntry.hideEntryDialog(true);
	};

	pub.showEditEntryDialogUnderEntry = function ($button, model, year, month, is_delete)
	{
		$('.entry_data').removeClass('editing');
		$('.edit').toggle(!is_delete);
		$('.delete').toggle(is_delete);
		var $status = $('#edit_dialog_status');
		var $actiontd = $('.edit_action');
		var action = is_delete ? "Delete" : "Edit";

		var $option_one = $('<input type="radio" name="scope" value="this">Only this</input>');
		$actiontd.html($option_one);
		$option_one.prop('checked', 'checked');

		if (model.get('monthly'))
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
			pub.hideEditEntryDialog(true);
			return;
		}
		jQueryHelpers.offsetElementFrom($dialog, $button, true);
		if (edit_selected != "")
			pub.hideEditEntryDialog(false);
		pub.showEditEntryDialog(true);

		if (!is_delete)
		{
			$('#edit_input_name').prop('disabled', 'disabled');
			$('#edit_input_name').val(model.get('name'));
			$('#edit_input_amount').val(Math.abs(model.get('amount')));
			$('#edit_input_amount').focus();
			$('#edit_input_amount').select();
			if (model.get('amount') > 0)
				$('#edit_entry_income').prop('checked', 'checked');
			else
				$('#edit_entry_expense').prop('checked', 'checked');
		}

		$dialog.data('model', model);
		$dialog.data('year', year);
		$dialog.data('month', month);

		$button.parents('.entry_data').addClass('editing');
		edit_selected = key;
	};

	pub.applyEdit = function ()
	{
		var $dialog = $('#edit_entry_div');
		var scope = $('input[name=scope]:checked').val();
		var model = $dialog.data('model');
		var year = $dialog.data('year');
		var month = $dialog.data('month');

		var amount = parseInt($('#edit_input_amount').val());
		var type = $('input[name=edit_entry_type]:checked').val();
		if (type == "Income")
			amount = Math.abs(amount);
		else
			amount = -Math.abs(amount);

		if (model.get('amount') == amount && scope != "all")
		{
			pub.hideEditEntryDialog();
			return;
		}

		if (model.get('monthly'))
		{
			if (scope == "all")
			{
				model.set('amount', amount);
				model.unset('modifications');
			}
			else if (scope == "this")
			{
				app.adjustMonthly(year, month, model.get('name'), amount);
			}
		}
		else
		{
			model.set('amount', amount);
		}

		pub.hideEditEntryDialog();
		app.refreshEntries();
	};

	pub.applyDelete = function ()
	{
		var $dialog = $('#edit_entry_div');
		var scope = $('input[name=scope]:checked').val();
		var model = $dialog.data('model');
		var year = $dialog.data('year');
		var month = $dialog.data('month');

		if (model.get('monthly'))
		{
			if (scope == "all")
			{
				app.monthly.remove(model);
			}
			else if (scope == "this")
			{
				app.deleteMonthly(year, month, model.get('name'));
			}
		}
		else
		{
			app.one_time.remove(model);
		}

		pub.hideEditEntryDialog();
		app.refreshEntries();
	};

	return pub;
})();

var jQueryHelpers = (function() {
	var pub = {};

	pub.onHoverOverHoverable = function(event)
	{
		$(this).find('.to_show_on_hover').toggle(event.type === 'mouseenter' && typeof app.viewing_other == "undefined");
	}

	pub.onDateFilterChanged = function()
	{
		app.dirtyFilter = true;
		var valid = app.validateFilter();
		if (valid)
			app.updateMonthFilterIndexes();
	}

	pub.initialElementSetup = function ()
	{
		$('#budget_return').hide();

		// Setup the popup dialogs
		dialogAddEntry.getEntryDialog().hide();
		dialogAddEntry.getEntryDialog().css('position', 'absolute');

		dialogEditEntry.getEditEntryDialog().hide();
		dialogEditEntry.getEditEntryDialog().css('position', 'absolute');

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

		pub.getMonthlyModificationsDialog().dialog({
			autoOpen:false,
			modal:true,
			width:400
		});
		$('#div_monthly_configuration').dialog({
			autoOpen:false,
			modal:true,
			width:800
		});

		$('#tabs').tabs();
	};

	pub.openEditMonthlyModifications = function (year, month)
	{
		var data = {
			month:month,
			year:year
		};
		var mods = app.modifications.where({'month':month, 'year':year});
		mods = _.sortBy(mods, function (model)
		{
			return model.get("name");
		});
		data.modifications = mods;
		if (data.modifications.length > 0)
		{
			pub.getMonthlyModificationsDialog().attr('title', "Monthly Modifications for " + month + " of " + year);
		}
		else
		{
			pub.getMonthlyModificationsDialog().attr('title', "No Monthly Modifications for " + month + " of " + year);
		}
		pub.getMonthlyModificationsDialog().html(server.render_template("popup_monthly_modifications", data));
		pub.getMonthlyModificationsDialog().data('year', year);
		pub.getMonthlyModificationsDialog().data('month', month);
		pub.getMonthlyModificationsDialog().dialog("open");
		$('.smallButton').blur();
	};

	pub.click_DeleteMonthlyMod = function (target)
	{
		var year = pub.getMonthlyModificationsDialog().data('year');
		var month = pub.getMonthlyModificationsDialog().data('month');
		var entryName = ($(target).parents(".monthly_mod")).attr('name');
		var delmatches = app.modifications.where({'month':month, 'year':year, 'name':entryName});
		if (delmatches.length == 1)
			app.modifications.remove(delmatches[0]);
		app.refreshEntries();
		pub.openEditMonthlyModifications(year, month);
	};

	pub.getMonthlyModificationsDialog = function ()
	{
		return $('#div_monthly_modifications');
	};

	var colorPickers = {};

	pub.showMonthlyConfigurationDialog = function ()
	{
		pub.getMonthlyConfigurationDialog().html(server.render_template('popup_monthly_configuration', app.monthly));
		pub.populateMonthYearSelectElements(pub.getMonthlyConfigurationDialog());
		$('.color_input').each(function (index, val)
		{
			var $el = $(val);
			var $row = $el.parents('.monthly_entry');
			var cid = $row.attr('name');
			var model = app.monthly.getByCid(cid);
			var picker = colorPickers[cid];

			var track = model.get('track');
			if (typeof track != "undefined")
			{
				$row.find('.month_select').val(track.month);
				$row.find('.year_select').val(track.year);
				$row.find('#track_start_balance').val(track.amount);
			}

			if (typeof picker != "undefined")
			{
				delete colorPickers[cid];
			}
			picker = new jscolor.color(val);
			pub.colorChange({'target':val});
			colorPickers[cid] = picker;
		});
		pub.getMonthlyConfigurationDialog().dialog("open");

		for (var prop in colorPickers)
		{
			if (colorPickers.hasOwnProperty(prop))
			{
				var pick = colorPickers[prop];
				pick.hidePicker();
			}
		}

		$('#apply_button').focus();
	};

	pub.colorChange = function (evt)
	{
		var $picker = $(evt.target);
		var $name = $picker.parents('.monthly_entry').find('#name_div');
		$name.css('color', $picker.css('background-color'));
	};

	pub.getMonthlyConfigurationDialog = function ()
	{
		return $('#div_monthly_configuration');
	};

	pub.getEditedStartBalance = function ($form)
	{
		var $input = $form.find('#startBalanceInput');
		var val = $input.val();
		return parseInt(val);
	};

	pub.updateStartBalanceLabel = function ($form, val)
	{
		var $label = $form.find('#startBalanceLabel');
		$label.html(app.formatDollars(val, '--'));
	};

	pub.hideStartBalanceInput = function ($form)
	{
		var $input = $form.find('#startBalanceInput');
		var $label = $form.find('#startBalanceLabel');
		$input.hide();
		$label.show();
	};

	pub.showStartBalanceInput = function ($form)
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
	};


	pub.updateDropdownSelections = function ()
	{
		// From year set to current year, to year set to next year
		// From and to months set to current month
		$(app.idDropdownFromYear).val(app.useDefined(app.years[app.getSettings()['fromYear']], app.curDate.getFullYear()));
		$(app.idDropdownFromMonth).val(app.useDefined(app.months[app.getSettings()['fromMonth']], app.months[app.curDate.getMonth()]));
		$(app.idDropdownToMonth).val(app.useDefined(app.months[app.getSettings()['toMonth']], app.months[(app.curDate.getMonth() - 1) % 12]));
		$(app.idDropdownToYear).val(app.useDefined(app.years[app.getSettings()['toYear']], app.curDate.getFullYear() + 1));
	};

	pub.populateSelectElements = function ()
	{
		for (var i = app.curDate.getFullYear() - 1; i <= app.curDate.getFullYear() + 2; i++)
		{
			app.years.push("" + i);
		}

		pub.populateMonthYearSelectElements();

		pub.populateSelector($(app.idDropdownNumCols), app.NUM_COLS);

		pub.updateDropdownSelections();

		app.updateMonthFilterIndexes();
	};

	pub.populateMonthYearSelectElements = function ($filter)
	{
		var monthFiller = pub.getSelectFiller(app.months);
		var yearFiller = pub.getSelectFiller(app.years);

		var yearFilter = $('.year_select');
		var monthFilter = $('.month_select');
		if (typeof $filter != "undefined")
		{
			yearFilter = $filter.find(yearFilter);
			monthFilter = $filter.find(monthFilter);
		}

		yearFilter.each(yearFiller);
		monthFilter.each(monthFiller);
	};

	pub.getSelectFiller = function (array)
	{
		return function (index, el)
		{
			pub.populateSelector($(el), array)
		};
	};

	pub.validateColorConfigurations = function ()
	{
		var $dialog = pub.getMonthlyConfigurationDialog();
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
				app.monthly.getByCid(cid).set('color', $val.val());
			}

			var model = app.monthly.getByCid(cid);
			var track = $row.find('.track_checkbox').prop('checked');
			if (track)
			{
				var startMonth = $row.find('.month_select').val();
				var startYear = $row.find('.year_select').val();
				var monthIndex = $row.find('.month_select option:selected').index();
				var yearIndex = $row.find('.year_select option:selected').index();
				var startAmount = $row.find('#track_start_balance').val();
				track = {
					'month':startMonth,
					'year':startYear,
					'monthIndex':monthIndex,
					'yearIndex':yearIndex,
					'amount':parseInt(startAmount)
				};
				model.set('track', track);
			}
			else
			{
				model.unset('track');
			}

		});
		return allGood;
	};

	pub.applyColorConfigurations = function ()
	{
		var validated = pub.validateColorConfigurations();
		if (validated)
		{
			pub.getMonthlyConfigurationDialog().dialog("close");
			app.refreshEntries();
		}
	};

	pub.initializeValidation = function ()
	{
		jQuery.validator.addMethod("alphanumeric", function (value, element)
		{
			return this.optional(element) || /^[a-zA-Z0-9]+$/.test(value);
		});
		jQuery.validator.addMethod("numeric", function (value, element)
		{
			return this.optional(element) || /^[0-9]+$/.test(value);
		});
		jQuery.validator.addMethod("existing_name", function (value)
		{
			var is_monthly = $('[name=monthly]:checked').val();
			var month = $('[name=selectorMonth]').val();
			var year = $('[name=selectorYear]').val();
			var monthly_exists = app.monthly.get(value);
			var one_time_exists = app.one_time.get(year + ":" + month + ":" + value);
			var lst = app.one_time.where({'name':value});
			if (is_monthly)
				return !(monthly_exists || lst.length > 0);
			return !monthly_exists && !one_time_exists;
		});

		app.validator = $('#add_dialog_form').validate({
			rules:{
				input_name:{
					required:true,
					existing_name:true
				},
				input_amount:{
					required:true,
					numeric:true
				}
			},
			messages:{
				input_name:"",
				input_amount:""
			},
			onkeyup:false
		});

		app.edit_validator = $('#edit_entry_form').validate({
			rules:{
				edit_input_amount:{
					required:true,
					numeric:true
				}
			},
			messages:{
				edit_input_name:"",
				edit_input_amount:""
			},
			onkeyup:false
		});
	};

	pub.addShare = function ()
	{
		var email = $('#share_input').val();
		$('#share_input').val('');
		server.addShareServer(email);
	};

	pub.deleteShare = function (event)
	{
		var email = $(event.target).parents('.share_row').attr('name');
		server.removeShareServer(email);
	};

	pub.setEntriesHtml = function (html)
	{
		$('#entries').html(html);
	};

	pub.switchToShare = function (event)
	{
		var email = $(event.target).parents('.share_row').attr('name');
		server.retrieveParseRefreshEntries(email);
		$('#tabs').tabs('select', 0);
	};

	pub.switchBack = function ()
	{
		server.retrieveParseRefreshEntries();
	};

	pub.refreshSharedWith = function ()
	{
		var data = {};
		data.sharing_with = app.sharing_with;
		data.shared = app.shared;
		$('#share_entries').html(server.render_template('table_shares', data));
		$('.to_show_on_hover').hide();
	};

	pub.renderMonthlyEntries = function ()
	{
		$('#monthly_entries').html(server.render_template('monthly_entries', app.sortByIncomeThenAmount(app.monthly.toArray())));
	};

	pub.postRenderMonthModules = function ()
	{
		// Hide start balance inputs
		$('.start_balance_input').hide();

		// Hide the buttons
		$('.to_show_on_hover').hide();
	};

	pub.changeDateSelector = function ()
	{
		if ($('#checkbox_monthly').is(':checked'))
		{
			$('.monthly_options').hide();
		}
		else
		{
			$('.monthly_options').show();
		}
	};

	pub.getNumCols = function ()
	{
		return $(app.idDropdownNumCols).prop('selectedIndex');
	};

	pub.getSelectedIndex = function (id)
	{
		return $(id).prop('selectedIndex');
	};

	pub.toggleSort = function ()
	{
		$('.sort').slideToggle('fast');
	};

	pub.offsetElementFrom = function ($toMove, $toOffsetFrom, topLeft)
	{
		var offsetX, offsetY;

		offsetY = $toOffsetFrom.height();
		if (topLeft)
			offsetX = -$toMove.width();
		else
			offsetX = $toOffsetFrom.width();

		var off = $toOffsetFrom.offset();
		off.left += offsetX;
		off.top += offsetY;
		$toMove.css(off);
	};

	pub.populateSelector = function (selector, options)
	{
		var $sel = $(selector);
		$sel.html('');
		for (var i = 0; i < options.length; i++)
		{
			$sel.append("<option value='" + options[i] + "'>" + options[i] + "</option>");
		}
	};


	return pub;
})();

var server = (function () {

	var pub = {};

	pub.retrieveParseRefreshEntries = function (viewing)
	{
		var data = {
			year:$('#idYearSelector').val()
		};

		if (typeof viewing != "undefined")
		{
			data.viewing = viewing;
		}

		$.get("/Entries", data, app.onReceiveJsonEntries, "json");
	};

	pub.saveData = function ()
	{
		var data = {
			'monthly':app.monthly.toJSON(),
			'one_time':app.one_time.toJSON(),
			'months':_.compact(app.getOnlyRelevantPartsOfMonths()),
			'sharing_with':app.sharing_with,
			'modifications':app.modifications,
			'settings':app.getSettings()
		};
		$.post("/Entries", JSON.stringify(data), function ()
		{
			app.refreshEntries();
		});
	};

	pub.addShareServer = function (email)
	{
		var data = {};
		data.add = email;
		$.post('/Share', data, function (result)
				{
					app.sharing_with = result["sharing_with"];
					app.shared = result["shared"];
					jQueryHelpers.refreshSharedWith();
				},
				"json");
	};

	pub.removeShareServer = function (email)
	{
		var data = {};
		data.remove = email;
		$.post('/Share', data, function (result)
				{
					app.sharing_with = result["sharing_with"];
					app.shared = result["shared"];
					jQueryHelpers.refreshSharedWith();
				},
				"json");
	};

	pub.render_template = function (tmpl_name, tmpl_data)
	{
		if (!pub.render_template.tmpl_cache)
		{
			pub.render_template.tmpl_cache = {};
		}

		if (!pub.render_template.tmpl_cache[tmpl_name])
		{
			var tmpl_dir = '/underscore_templates';
			var tmpl_url = tmpl_dir + '/' + tmpl_name + '.html';

			var tmpl_string = "";
			$.ajax({
				url:tmpl_url,
				method:'GET',
				async:false,
				success:function (data)
				{
					tmpl_string = data;
				}
			});

			pub.render_template.tmpl_cache[tmpl_name] = _.template(tmpl_string);
		}

		return pub.render_template.tmpl_cache[tmpl_name](tmpl_data);
	};

	return pub;
})();