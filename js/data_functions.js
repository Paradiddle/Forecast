var monthFilters = {};

function getMonthFilterIndexes()
{
	return monthFilters;
}

function updateMonthFilterIndexes()
{
	monthFilters.toMonth = getSelectedIndex(idDropdownToMonth);
	monthFilters.fromMonth = getSelectedIndex(idDropdownFromMonth);
	monthFilters.toYear = getSelectedIndex(idDropdownToYear);
	monthFilters.fromYear = getSelectedIndex(idDropdownFromYear);
}

function updateStartBalance(year, month, val)
{
	var m = monthsMeta.get(months_meta_key(year, month));
	m.set('start_balance', val);
}

function sortByIncomeThenAmount(models)
{
	// Group by expense and income
	var groups = _.groupBy(models, function(value) {return value.get('amount') < 0;});
	// Sort both expenses and income by amount
	for(var key in groups)
	{
		groups[key] = _.sortBy(groups[key], function(value) {
			return -Math.abs(value.get('amount'));
		});
	}
	
	// Populate our new list of entries in the order of Income followed by Expenses
	var arr = [];
	if(groups['false'] != undefined)
		arr = arr.concat(groups['false']);
	if(groups['true'] != undefined)
		arr = arr.concat(groups['true']);
	return arr;
}

function formatDollars(num, undefinedFallback, showpositive)
{
	if(typeof showpositive == "undefined")
		showpositive = false;
	if(typeof num == "undefined")
		return undefinedFallback;
	if(num < 0)
		return "-$" + Math.abs(num);
	if(showpositive)
		return "+$" + num;
	return "$" + num;
}

function getModifiedAmount(model, year, month)
{
	var mods = model.get('modifications');
	if(typeof mods != "undefined")
	{
		var mod = mods[year + ":" + month];
		if(typeof mod != "undefined")
		{
			if(mod.type == "delete")
				return undefined;
			else if(mod.type == "adjust")
			{
				return parseInt(mod.amount);
			}
		}
	}
	return parseInt(model.get('amount'));
}

function getNextMonthMeta(yearIndex, monthIndex)
{
	var year = parseInt(years[yearIndex]);
	if(monthIndex < months.length - 1)
		monthIndex++;
	else
	{
		monthIndex = 0;
		year++;
	}
	return "" + year + ":" + months[monthIndex];
}

function getPreviousMonthMeta(yearIndex, monthIndex)
{
	var year = parseInt(years[yearIndex]);
	if(monthIndex > 0)
		monthIndex--;
	else
	{
		monthIndex = months.length - 1;
		year--;
	}
	return "" + year + ":" + months[monthIndex];
}

function deleteMonthly(year, month, name)
{
	var mod = {
		'type': 'delete'
	};
	putMonthlyModification(year, month, name, mod);
}

function adjustMonthly(year, month, name, amount)
{
	var mod = {
		'type': 'adjust',
		'amount': amount
	};
	putMonthlyModification(year, month, name, mod);
}

function putMonthlyModification(year, month, name, mod)
{
	mod.year = year;
	mod.month = month;
	var model = monthly.get(name);
	var modifications = model.get('modifications');
	if(typeof modifications == "undefined")
	{
		modifications = {};
		model.set('modifications', modifications);
	}
	modifications[year + ":" + month] = mod;
}

function onReceiveJsonEntries(jsonData)
{
	viewing_other = jsonData.viewing_other;
	parseData(jsonData);
	refreshEntries();
	refreshSharedWith();
}

function getEntriesArrayForYearMonth(year, month)
{
	var one_times = one_time.where({'year': year, 'month': month});
	return one_times.concat(monthly.toArray());
}

function one_time_key(year, month, name)
{
	return "" + year + ":" + month + ":" + name;
}

function deleteEmail(email)
{
	sharing_with.splice(sharing_with.indexOf(email), 1);
}

function months_meta_key(year, month)
{
	return year + ":" + month;
}

function parseData(data)
{
	monthly = new Backbone.Collection(data['monthly']);
	one_time = new Backbone.Collection(data['one_time']);
	monthsMeta = new Backbone.Collection(data['months']);
	sharing_with = data['sharing_with'];
	shared = data['shared'];
}

function getOnlyRelevantPartsOfMonths()
{
	return monthsMeta.map(function(value, key, list) {
		var sbal = value.get('start_balance');
		if(typeof sbal != "undefined")
		{
			return {id: value.id, start_balance: sbal};
		}
		return null;
	});
}

var yearMonthIteratorData;

function updateYearMonthIterator()
{
	yearMonthIteratorData = [];
	
	var filter = getMonthFilterIndexes();
	
	// Iterate through each year from the starting year to the ending year
	for ( var currentYearNum = filter.fromYear; currentYearNum <= filter.toYear; currentYearNum++)
	{
		// If the current year is the first year of the selection then the starting 
		// month will be the selected starting month, otherwise we start at January.
		var startingMonthNum = (currentYearNum == filter.fromYear) ? filter.fromMonth : 0;

		// If the current year is the last year of the selection then the ending
		// month will be the selected ending month, otherwise we end at December.
		var endingMonthNum = (currentYearNum == filter.toYear) ? filter.toMonth : 11;

		for ( var currentMonthNum = startingMonthNum; currentMonthNum <= endingMonthNum; currentMonthNum++)
		{
			var currentMonthStr = months[currentMonthNum];
			var currentYearStr = years[currentYearNum];
			var obj = {
				month: currentMonthStr,
				year: currentYearStr,
				month_num: currentMonthNum,
				year_num: currentYearNum,
				meta: monthsMeta.get(currentYearStr + ":" + currentMonthStr)
			};
			yearMonthIteratorData.push(obj);
		}
	}
}

function getEntriesTableTemplateData()
{
	var valid = validateFilter();
	if (!valid)
	{
		alert("Not a valid to and from filter.");
		return;
	}

	var templateData = {};
	templateData.rowData = [];
	var numCols = NUM_COLS[getNumCols()];
	templateData.entryWidth = 100 / numCols;
	
	var rowMonthsData = [];
	var curIndex = 0;
	
	for(var j = 0; j < yearMonthIteratorData.length; j++)
	{
		var month = yearMonthIteratorData[j];
		
		monthData = {};
		monthData.month = month.month;
		monthData.year = month.year;
		
		curIndex++;
		rowMonthsData.push(monthData);
		if(curIndex == numCols || month.month == "December")
		{
			curIndex = 0;
			templateData.rowData.push(rowMonthsData);
			rowMonthsData = [];
		}
	}
	if(rowMonthsData.length > 0)
		templateData.rowData.push(rowMonthsData);
	
	return templateData;
}

function calculateAllMonthData()
{
	for(var y = 0; y < years.length; y++)
	{
		for(var m = 0; m < months.length; m++)
		{
			var yearString = years[y];
			var monthString = months[m];
			var id = yearString + ":" + monthString;
			var meta = monthsMeta.get(id);
			if(meta == undefined)
			{
				meta = new Backbone.Model();
				meta.set('id', id);
				monthsMeta.add(meta);
			}
			
			var entries = getEntriesArrayForYearMonth(yearString, monthString);
			var total_expenses = 0;
			var total_income = 0;
			for(var e = 0; e < entries.length; e++)
			{
				var entry = entries[e];
				var amount = getModifiedAmount(entry, yearString, monthString);
				if(typeof amount == "undefined")
					continue;
				if(amount > 0)
					total_income += amount;
				else
					total_expenses -= amount;
			}
			var diff = total_income - total_expenses;
			var start_balance = meta.get('start_balance');
			var prevMonthMeta = monthsMeta.get(getPreviousMonthMeta(y, m));
			var prevEstEndBalance = undefined;
			if(prevMonthMeta != undefined)
				prevEstEndBalance = prevMonthMeta.get('est_end_balance');
			if(start_balance != undefined)
			{
				meta.set('est_end_balance', start_balance + diff);
				if(prevMonthMeta != undefined && prevEstEndBalance != undefined)
				{
					var disc = start_balance - prevEstEndBalance;
					prevMonthMeta.set('discrepancy', disc);
				}
			}
			else
			{
				if(prevMonthMeta != undefined)
				{
					if(prevEstEndBalance != undefined)
					{
						meta.set('est_start_balance', prevEstEndBalance);
						meta.set('est_end_balance', prevEstEndBalance + diff);
					}
				}
			}
			meta.set('total_income', total_income);
			meta.set('total_expenses', total_expenses);
			meta.set('difference', diff);
			meta.set('next_month', getNextMonthMeta(y, m));
			meta.set('prev_month', getPreviousMonthMeta(y, m));
		}
	}
}

function validateFilter()
{
	var filter = getMonthFilterIndexes();
	if (filter.fromYear <= filter.toYear && (filter.fromMonth <= filter.toMonth || filter.toYear > filter.fromYear))
		return true;
	return false;
}

function addEntry(name, amount, is_monthly, year, month)
{
	var data = {
		name: name,
		amount: amount,
		monthly: is_monthly,
		year: year,
		month: month
	};
	
	var model = undefined;
	var key = undefined;
	
	if (is_monthly)
	{
		key = name;
		model = monthly.get(key);
		
		if(typeof model != "undefined")
			return false;
		
		delete data.month;
		delete data.year;
		model = new Backbone.Model(data);
		model.set('id', key);
		monthly.add(model);
	} 
	else
	{
		key = one_time_key(year, month, name);
		model = one_time.get(key);
		
		if(typeof model != "undefined")
			return false;
		
		model = new Backbone.Model(data);
		model.set('id', key);
		one_time.add(model);
	}
	return true;
}