$(document).ready(function()
{
	_.templateSettings.variable = "data";
	$('#budget_return').hide();		
	jQuery.fn.outerHTML = function(s) {
		return (s)
		? this.before(s).remove()
		: jQuery("<p>").append(this.eq(0).clone()).html();
	};
	
	addCustomValidators();
	initializeValidation();
	
	initialElementSetup();
	
	$('.dirtyfilter').on("change", function() {
		dirtyFilter = true;
		updateMonthFilterIndexes();
	});

	$('body').delegate('.show_on_hover', "hover",
		function(event) {
			$(this).find('.to_show_on_hover').toggle(event.type === 'mouseenter' && typeof viewing_other == "undefined");
		}
	);
	
	$('#tabs').tabs();
	
	retrieveParseRefreshEntries();
});

/*
 * Global variables
 */

var dirtyFilter = true;

var idDropdownToMonth = '#to_month';
var idDropdownToYear = '#to_year';
var idDropdownFromMonth = '#from_month';
var idDropdownFromYear = '#from_year';

var idDropdownNumCols = '#num_cols';
var validator;
var edit_validator;

// Template function for the monthly entries
var templateMonthly;

// Template function for the month display section.
var templateEntries;

// populated statically
var years = [];
var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

// TODO Static options for 
var NUM_COLS = [ 2, 3, 4 ];

// Collection representing all the monthly entries, one Model per monthly entry
var monthly;

// Collection representing all the one_time entries, one Model per entry
var one_time;

// Collection of metadata associated with each month, one Model per month
var monthsMeta;

// Collection of monthly modifications
var modifications;

// Array of e-mails you're sharing your budget with
var sharing_with;

// Array of e-mails sharing their budget with you
var shared;

// A string that represents whether or not you are viewing someone else's budget.
// undefined if you are viewing your own, set to email address of other account when viewing another.
var viewing_other = undefined;

// View that represents an individual month for a given year
var MonthModule;

var monthModuleViews = {};

function refreshEntries()
{
	calculateAllMonthData();
	if(dirtyFilter)
	{
		updateYearMonthIterator();
		var data = getEntriesTableTemplateData();
		setEntriesHtml(render_template('entries_table', data));
	}

	recalculateAndRenderMonthModules();
	renderMonthlyEntries();
	
	dirtyFilter = false;

	$('.modify_data').toggle(viewing_other == undefined);
	postRenderMonthModules();
	if(typeof viewing_other == "undefined")
	{
		$('#budget_name').hide();	
		$('#budget_return').hide();		
	}
	else
	{
		$('#budget_name').show();
		$('#budget_name').html("Viewing budget for '" + viewing_other + "'");
		$('#budget_return').show();
	}
}