var boxes = [];
var canvas;
var ctx;

var gridSpacing = 10.0;
var gridWidth;
var gridHeight;

var selectedModel;

var pictureCount = 1;

$(document).ready(function(evt) {
	boxes = new Backbone.Collection();
	canvas = $('#myCanvas').get(0);
	window.addEventListener('resize', onResizeWindow, false);
	ctx = canvas.getContext("2d");
	onResizeWindow();
	$('#boxlist').change(onPictureListChange);
	$('#add').click(onClickAdd);
	//$('#myCanvas').mousedown(canvasClick);
});

function onPictureListChange(evt)
{
	selectedModel = boxes.get($('#boxlist option:selected').val());
	redraw();
}

function onClickAdd()
{
	var name = $('input[name=name]');
	var box = createBox(getRandomXLocation(), getRandomYLocation(), name.val());
	$('input[name=name]').val('');
	boxes.add(box);
	redraw();
}

function createBox(x, y, name)
{
	var model = boxes.get(name);
	if(typeof name == "undefined" || name === "" || typeof model != "undefined")
	{
		name = "P" + pictureCount;
	}

	var box = new Backbone.Model();
	box.set('x', x);
	box.set('y', y);
	box.set('width', (Math.floor(Math.random() * 5 + 1.5) * gridSpacing));
	box.set('height', (Math.floor(Math.random() * 5 + 1.5) * gridSpacing));
	box.set('name', name);
	box.set('id', name);

	$('#boxlist').append('<option>' + name + '</option>');
	pictureCount++;
	return box;
}

function getRandomXLocation()
{
	return Math.floor(Math.random() * (gridWidth - 5)) * gridSpacing;
}

function getRandomYLocation()
{
	return Math.floor(Math.random() * (gridHeight - 3)) * gridSpacing;
}

function onResizeWindow()
{
	canvas.width = window.innerWidth - 200;
	canvas.height = window.innerHeight;
	redraw();
}

function canvasClick(evt)
{
	evt.preventDefault();
	var x = evt.offsetX;
	var y = evt.offsetY;

	if(x > canvas.width)
		x = canvas.width;
	if(y > canvas.height)
		y = canvas.height;

	x -= x % gridSpacing;
	y -= y % gridSpacing;

	var box =
	{
		x: x,
		y: y
	};
	boxes.push(box);
	redraw();
	return false;
}

function redraw()
{
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawGrid();
	drawBoxes();
}

function drawBoxes()
{
	ctx.lineWidth = 3.0;
	ctx.fillStyle = "#000000";
	boxes.each(function(model, index, collection) {
		ctx.fillRect(model.get('x') + 0.5, model.get('y') + 0.5, model.get('width'), model.get('height'));
		if(model == selectedModel)
		{
			ctx.strokeStyle = "#44DD44";
			ctx.beginPath();
			ctx.moveTo(model.get('x'), model.get('y'));
			ctx.lineTo(model.get('x') + model.get('width') + 1.0, model.get('y'));
			ctx.lineTo(model.get('x') + model.get('width') + 1.0, model.get('y') + model.get('height') + 1.0);
			ctx.lineTo(model.get('x'), model.get('y') + model.get('height') + 1.0);
			ctx.lineTo(model.get('x'), model.get('y'));
			ctx.closePath();
			ctx.stroke();
		}
	});
}

function drawGrid()
{
	ctx.lineWidth = 1.0;
	ctx.strokeStyle = "#EEEEEE";
	gridWidth = 0;
	gridHeight = 0;
	for(var x = 0.5; x < canvas.width; x += gridSpacing)
	{
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, canvas.height);
		ctx.closePath();
		ctx.stroke();
		gridWidth++;
	}

	for(var y = 0.5; y < canvas.height; y+= gridSpacing)
	{
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(canvas.width, y);
		ctx.closePath();
		ctx.stroke();
		gridHeight++;
	}
}