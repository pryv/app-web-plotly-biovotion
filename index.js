var container = document.getElementById("pryvGraphs");
var monitor;


/**
 * retrieve the registerURL from URL parameters
 */
function getRegisterURL() {
  return pryv.utility.urls.parseClientURL().parseQuery()['pryv-reg'];
}

var customRegisterUrl = getRegisterURL();
if (customRegisterUrl) {
  pryv.Auth.config.registerURL = {host: customRegisterUrl, 'ssl': true};
}

/**
 * retrieve the registerURL from URL parameters
 */
function getSettingsFromURL() {
  var settings = {
    username : pryv.utility.urls.parseClientURL().parseQuery()['username'],
    domain : pryv.utility.urls.parseClientURL().parseQuery()['domain'],
    auth: pryv.utility.urls.parseClientURL().parseQuery()['auth']
  }

  if (settings.username && settings.auth) {
    return settings;
  }

  return null;
}


var settings = getSettingsFromURL();
if (settings) {
  var connection = new pryv.Connection(settings);
  connection.fetchStructure(function () {
    setupMonitor(connection);
  });
} else {

  // Authenticate user
  var authSettings = {
      requestingAppId: 'appweb-plotly',
      requestedPermissions: [
          {
              streamId: '*',
              level: 'manage'
          }
      ],
      returnURL: false,
      spanButtonID: 'pryv-button',
      callbacks: {
          needSignin: resetGraphs,
          needValidation: null,
          signedIn: function (connect) {
              connect.fetchStructure(function () {
                  setupMonitor(connect);
              });
          }
      }
  };

  pryv.Auth.setup(authSettings);
}

// MONITORING
// Setup monitoring for remote changes
function setupMonitor(connection) {
    var filter = new pryv.Filter();
    monitor = connection.monitor(filter);

    // should be false by default, will be updated in next lib version
    // to use fullCache call connection.ensureStructureFetched before
    monitor.ensureFullCache = false;
    monitor.initWithPrefetch = 0; // default = 100;

    // get notified when monitoring starts
    monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_LOAD, function (events) {
        updateGraph(events);

    });

    // get notified when data changes
    monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_EVENT_CHANGE, function (changes) {
        updateGraph(changes.created);
    });

    // start monitoring
    monitor.start(function (err) {
    });
}

// GRAPHS
var graphs = {};

function getDateString(timestamp) {
  var date = new Date(timestamp);
  return date.toISOString().substring(0, 10) + ' '
    + date.toISOString().substring(11, 19) + '.' + date.getMilliseconds();
}

function createGraph(event) {
  var graphKey = event.streamId + '_' + event.type;

  if (! pryv.eventTypes.isNumerical(event)) {
    graphs[graphKey] = { ignore : true};
    return;
  }

  var extraType = pryv.eventTypes.extras(event.type);

  var titleY = extraType.symbol ? extraType.symbol : event.type;


  var title = '';
  event.stream.ancestors.forEach(function (ancestor) { 
     title += ancestor.name + '/';
  });
  title += event.stream.name;


  graphs[graphKey] = {
    type: event.type,
    streamId: event.streamId + ' ' + titleY,
    trace: {
      x: [],
      y: [],
      mode: 'lines',
      name: event.stream.name,
      type: 'scatter'
    },
    layout : {
      title: title,
      xaxis1: {
        title: 'Time',
        showticklabels : true
      },
      yaxis1: {
        title: titleY,
        showticklabels : true
      }
    }
  };
  if (document.getElementById(graphKey) === null) {
    var graph = document.createElement('div');
    graph.setAttribute('id', graphKey);
    container.appendChild(graph);
  };

  Plotly.newPlot(graphKey, [graphs[graphKey].trace], graphs[graphKey].layout);
}

function updateGraph(events) {
    // needed ?
    events = events.sort(function (a, b) {
      return a.time - b.time;
    });

    var toRedraw = {};

    events.map(function (event) {
      var graphKey = event.streamId + '_' + event.type;
      if (! graphs[graphKey]) { // create New Trace
        createGraph(event);
      }

      if (! graphs[graphKey].ignore) {
        graphs[graphKey].trace.x.push(getDateString(event.timeLT));
        graphs[graphKey].trace.y.push(event.content);

        toRedraw[graphKey] = true;
      }

    });

     Object.keys(toRedraw).forEach(function (graphKey) {
         Plotly.redraw(graphKey);
     });
};

function resetGraphs() {
    if (monitor) {
        monitor.destroy();
    }
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}