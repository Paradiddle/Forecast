function retrieveParseRefreshEntries(viewing)
{
	var data = {
		year: $('#idYearSelector').val()
	};
	
	if(typeof viewing != "undefined")
	{
		data.viewing = viewing;
	}
	
	$.get("/Entries", data, onReceiveJsonEntries, "json");
}

function saveData()
{
	data = {
		'monthly': monthly.toJSON(),
		'one_time': one_time.toJSON(),
		'months': _.compact(getOnlyRelevantPartsOfMonths()),
		'sharing_with': sharing_with,
		'modifications': modifications
	};
	$.post("/Entries", JSON.stringify(data), function(result) {refreshEntries();});	
}

function addShareServer(email)
{
	var data = {};
	data.add = email;
	$.post('/Share', data, function(result) {
		sharing_with = result["sharing_with"];
		shared = result["shared"];
		refreshSharedWith();
	},
	"json");
}

function removeShareServer(email)
{
	var data = {};
	data.remove = email;
	$.post('/Share', data, function(result) {
		sharing_with = result["sharing_with"];
		shared = result["shared"];
		refreshSharedWith();
	},
	"json");
}

function render_template(tmpl_name, tmpl_data) {
    if ( !render_template.tmpl_cache ) { 
        render_template.tmpl_cache = {};
    }

    if ( ! render_template.tmpl_cache[tmpl_name] ) {
        var tmpl_dir = '/underscore_templates';
        var tmpl_url = tmpl_dir + '/' + tmpl_name + '.html';

        var tmpl_string;
        $.ajax({
            url: tmpl_url,
            method: 'GET',
            async: false,
            success: function(data) {
                tmpl_string = data;
            }
        });

        render_template.tmpl_cache[tmpl_name] = _.template(tmpl_string);
    }

    return render_template.tmpl_cache[tmpl_name](tmpl_data);
}