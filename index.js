// Useful modules
var path = require('path');
var util = require('util');
// Mustache - easy string templates
var mustache = require('mustache');
// useful debug functions
var debug = require('./debug');

var irc = require('irc');
var config = require('./config.json');

var plugins = new Array();

// Some config
debug.on = config.debug;

// Inform about error
function showPluginRuntimeError(pluginName, method, exception) {
	var data = {
		plugin: pluginName,
		message: exception.message,
		method: method
	};

	var pattern = 'Module {{&plugin}} runtime error: {{&message}} in {{&method}}';
	var output = mustache.render(pattern, data);
	debug.error(output);
}

function initPlugins() {
	for (var i in config.plugins) {
		var pluginPath = './' +
			path.join(config.plugins_conf.dir, config.plugins[i]);

		debug.debug('Plugin ' + config.plugins[i] + ' path: ' + pluginPath);

		var tempPlugin;

		try {
			tempPlugin = require(pluginPath);
		} catch (e) {
			var data = {
				plugin: config.plugins[i],
				message: e.message
			};

			var pattern = 'Module {{&plugin}} load error: {{&message}}';
			var output = mustache.render(pattern, data);
			debug.error(output);

			// If module name is wrong don't add that
			continue;
		}

		debug.success('Module: ' + config.plugins[i] + ' loaded');
		plugins.push(tempPlugin);

		// Init event
		plugins[i].onPluginInit();
	}

	if (plugins.length > 0) {
		var messageToLog = util.format('Loaded %s modules of %s',
			plugins.length,
			config.plugins.length
		);
		debug.success(messageToLog);
	} else {
		debug.warning('No module of ' + config.plugins.length + ' loaded');
	}
}

// Send events to the plugins
function onBotJoin(channel) {
	if (!channel) {
		debug.warning('onBotJoin(channel) requires 1 argument, given 0');
		return;
	}

	for (var i in plugins) {
		try {
			plugins[i].onBotJoin(channel);
		} catch (e) {
			showPluginRuntimeError(plugins[i].meta.name, 'onBotJoin()', e);
		}
	}
}

function onUserJoin(channel, user) {
	if (!channel || !user) {
		debug.warning('onUserJoin(channel, user) requires 2 arguments');
		return;
	}

	for (var i in plugins) {
		try {
			plugins[i].onUserJoin(channel, user);
		} catch (e) {
			showPluginRuntimeError(plugins[i].meta.name, 'onBotJoin()', e);
		}
	}
}

// Start bot = main function
debug.log('Bot is starting up at the moment..');

var bot = new irc.Client(
	config.server.host,
	config.bot.nick, {
		port: config.server.port,
		channels: config.channels
	}
);

initPlugins();

bot.addListener('join', function (channel, user) {
	if (user == bot.nick) {
		onBotJoin(channel);
		return;
	}

	// If user join to the channel
	onUserJoin(channel, user);
});