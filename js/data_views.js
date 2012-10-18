MonthModule = Backbone.View.extend({
	initialize: function(params, year, month, meta) {
		this.year = year;
		this.month = month;
		this.meta = meta;
		this.data = {
			year: year,
			month: month,
			shortYear: year.substr(2, 3),
			shortMonth: month.substr(0, 3)
		};
		this.calculate();
	},
	calculate: calculate_MonthModule,
	events: {
		"click #addButton": click_AddButton,
		"click #startBalanceLabel": click_StartBalanceLabel,
		"submit #startBalanceForm": submit_StartBalanceForm,
		"click #editButton": click_EditEntry,
		"click #deleteButton": click_DeleteEntry
	},
	render: render_MonthModule
});

function calculate_MonthModule()
{
	this.data.total_expenses = this.meta.get('total_expenses');
	this.data.total_income = this.meta.get('total_income');
	this.data.entries = sortByIncomeThenAmount(getEntriesArrayForYearMonth(this.year, this.month));
	this.data.end_balance = this.meta.get('est_end_balance');
	this.data.meta = this.meta;
	var currentStartBalance = this.meta.get('start_balance');
	if(currentStartBalance != undefined)
		this.data.start_balance = currentStartBalance;
	else
		this.data.start_balance = this.meta.get('est_start_balance');
	this.data.discrepancy = this.meta.get('discrepancy');	
}

function render_MonthModule()
{
	$(this.el).html(render_template('month_module', this.data));
	return this;
}

function click_EditEntry(event)
{
	var entryName = ($(event.target).parents(".entry_data")).attr('name');
	showEditEntryDialogUnderEntry($(event.target), this.data.entries[entryName], this.year, this.month, false);	
}

function click_DeleteEntry(event)
{
	var entryName = ($(event.target).parents(".entry_data")).attr('name');
	showEditEntryDialogUnderEntry($(event.target), this.data.entries[entryName], this.year, this.month, true);
}

function click_AddButton(event)
{
	showEntryDialogUnderYearMonth($(event.target), this.year, this.month);	
}

function submit_StartBalanceForm(event)
{
	var $form = $(event.target);
	var newStartBalance = getEditedStartBalance($form);
	hideStartBalanceInput($form);
	updateStartBalance(this.year, this.month, newStartBalance);
	updateStartBalanceLabel($form, newStartBalance);
	refreshEntries();
	return false;
}

function click_StartBalanceLabel(event)
{
	var $form = $(event.target).parents('#startBalanceForm');
	showStartBalanceInput($form);
}

function recalculateAndRenderMonthModules()
{
	for(var j = 0; j < yearMonthIteratorData.length; j++)
	{
		var month = yearMonthIteratorData[j];
		var key = month.year + ":" + month.month;
		var module = monthModuleViews[key];
		var $stuff = $('.' + month.month).filter('.' + month.year);
		if(typeof module == "undefined")
		{
			var meta = monthsMeta.get(month.year + ":" + month.month);
			module = new MonthModule({
				el: $stuff
			}, month.year, month.month, meta);
			monthModuleViews[key] = module;
		}
		if(dirtyFilter)
		{
			module.el = $stuff;
			module.$el = $stuff;
			module.delegateEvents();
		}
		module.calculate();
		module.render();
	}
}