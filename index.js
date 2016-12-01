/*globals document, pryv, _, Plotly*/
var container = document.getElementById('pryvGraphs');
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
    username : pryv.utility.urls.parseClientURL().parseQuery().username,
    domain : pryv.utility.urls.parseClientURL().parseQuery().domain,
    auth: pryv.utility.urls.parseClientURL().parseQuery().auth
  };

  if (settings.username && settings.auth) {
    return settings;
  }

  return null;
}

document.onreadystatechange = function () {
  var state = document.readyState;
  if (state == 'complete') {
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
            level: 'read'
          }
        ],
        returnURL: false,
        spanButtonID: 'pryv-button',
        callbacks: {
          needSignin: resetPlots,
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
  }
};

// MONITORING
// Setup monitoring for remote changes
function setupMonitor(connection) {
  var filter = new pryv.Filter({fromTime: 12});
  monitor = connection.monitor(filter);

  // should be false by default, will be updated in next lib version
  // to use fullCache call connection.ensureStructureFetched before
  monitor.ensureFullCache = false;
  monitor.initWithPrefetch = 0; // default = 100;

  // get notified when monitoring starts
  monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_LOAD, function (events) {
    updatePlot(events);

  });

  // get notified when data changes
  monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_EVENT_CHANGE, function (changes) {
    updatePlot(changes.created);
  });

  // start monitoring
  monitor.start(function (/**err**/) {
  });
}

// Traces
var traces = {};



var presets = {
  'biovotion-bpm_frequency/bpm' : {
    gaps: 30,
    plotKey : 'bpm-bpw',
    trace: {
      name: 'Heart rate',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-bpw_count/generic' : {
    gaps: 30,
    plotKey : 'bpm-bpw',
    trace: {
      name: 'Blood P. W.',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'cirxezp55551ezqyqdwe554wu_frequency/bpm': {
    //gaps: 30,
    plotKey : 'Multiple',
    trace: {
      name: 'BPM',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'cirxez1sb5519zqyqod67labt_density/mmol-l': {
    //gaps: 30,
    plotKey : 'Multiple',
    trace: {
      name: 'Glycemia',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'cirzws1yp55mxzqyqr0s8qtt6_energy/cal': {
    //gaps: 30,
    plotKey : 'Multiple',
    trace: {
      name: 'Calories',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'cirzwnqgp55mhzqyqhpi3ph9h_count/steps': {
    //gaps: 30,
    plotKey : 'Multiple',
    trace: {
      name: 'Steps',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  }

};

var plots = {
  'bpm-bpw' : {
    layout :  { title : 'BPM / BPW' }
  }
};




function getDateString(timestamp) {
  var date = new Date(timestamp);
  return date.toISOString().substring(0, 10) + ' '  +
    date.toISOString().substring(11, 19) + '.' + date.getMilliseconds();
}

function createTrace(event) {
  var traceKey = event.streamId + '_' + event.type;

  if (! pryv.eventTypes.isNumerical(event)) {
    traces[traceKey] = { ignore : true};
    return;
  }

  var extraType = pryv.eventTypes.extras(event.type);

  var titleY = extraType.symbol ? extraType.symbol : event.type;


  console.log(traceKey);

  traces[traceKey] = {
    plotKey: traceKey,
    type: event.type,
    streamId: event.streamId + ' ' + titleY,
    last: event.timeLT,
    gaps: null,
    trace: {},
    yaxis : {
      yaxis1: {
        title : titleY,
        showticklabels : true,
        side: 'right'
      }
    }
  };

  if (presets[traceKey]) {
    _.extend(traces[traceKey], presets[traceKey]);
  }

  /** add holders for data **/
  traces[traceKey].trace.x = [];
  traces[traceKey].trace.y = [];

  if (! plots[traces[traceKey].plotKey]) {
    // create a singleton plot
    var title = '';
    event.stream.ancestors.forEach(function (ancestor) {
      title += ancestor.name + '/';
    });
    title += event.stream.name;
    plots[traces[traceKey].plotKey] = {
      layout : { title : title }
    };
  }


  plots[traces[traceKey].plotKey].layout.xaxis = {
    //rangeselector: selectorOptions,
    title: 'Time',
    showticklabels : true
  };

  if (! plots[traces[traceKey].plotKey].num) { // first plot
    plots[traces[traceKey].plotKey].num = 1;
    traces[traceKey].layout = {
      yaxis1: {
        title : titleY,
        showticklabels : true,
        side: 'left'
      }
    };

  } else {   // next ones

    var num = ++plots[traces[traceKey].plotKey].num;
    var pos = 1 - + ((num-2) * 0.05);
    traces[traceKey].layout = {};
    traces[traceKey].layout['yaxis' + num] = {
      title : titleY,
      showticklabels : true,
      side: 'right',
      overlaying: 'y',
      position: pos
    };
    traces[traceKey].trace.yaxis = 'y' + num;
  }
}


var initializedTraces = {};
var initializedPlots = {};

function initOrRedraw(traceKey) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('logo-pryv').style.display = 'initial';

  var trace = traces[traceKey];
  if (initializedTraces[traceKey]) {
    return Plotly.redraw(trace.plotKey);
  }
  initializedTraces[traceKey] = true;

  if (! initializedPlots[trace.plotKey]) {
    initializedPlots[trace.plotKey] = true;
    var plot = document.createElement('div');
    plot.setAttribute('id', trace.plotKey);
    container.appendChild(plot);

    Plotly.newPlot(trace.plotKey, [], plots[trace.plotKey].layout);
  }

  Plotly.relayout(traces[traceKey].plotKey, trace.layout);
  Plotly.addTraces(traces[traceKey].plotKey, [traces[traceKey].trace]);


}


var ignoreFrom = ((new Date().getTime())) - (60 * 60 * 24 * 1000 * 10);

function updatePlot(events) {
  // needed ?
  events = events.sort(function (a, b) {
    return a.time - b.time;
  });

  var toRedraw = {};

  events.map(function (event) {
    var traceKey = event.streamId + '_' + event.type;
    if (! traces[traceKey]) { // create New Trace
      createTrace(event);
    }


    if (event.trashed || (ignoreFrom > event.timeLT)) {
    //  console.log(new Date(ignoreFrom), new Date(event.timeLT), ignoreFrom, event.timeLT, ignoreFrom - event.timeLT);

      return;
    }
    //console.log(new Date(event.timeLT));

    if (! traces[traceKey].ignore) {


      if (traces[traceKey].gaps) {
        if ((event.timeLT - traces[traceKey].last) > traces[traceKey].gaps * 1000) {
          traces[traceKey].trace.x.push(getDateString(traces[traceKey].last + 1));
          traces[traceKey].trace.y.push(null);
        }
      }

      traces[traceKey].trace.x.push(getDateString(event.timeLT));
      traces[traceKey].trace.y.push(event.content);

      traces[traceKey].last = event.timeLT;

      toRedraw[traceKey] = true;
    }

  });

  Object.keys(toRedraw).forEach(function (traceKey) {
    initOrRedraw(traceKey);
  });
}



function resetPlots() {
  document.getElementById('loading').style.display = 'initial';
  document.getElementById('logo-pryv').style.display = 'none';
  if (monitor) {
    monitor.destroy();
  }
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}


// *** Plotly designs ***  //
var selectorOptions = {
  buttons: [{
    step: 'month',
    stepmode: 'backward',
    count: 1,
    label: '1m'
  }, {
    step: 'month',
    stepmode: 'backward',
    count: 6,
    label: '6m'
  }, {
    step: 'year',
    stepmode: 'todate',
    count: 1,
    label: 'YTD'
  }, {
    step: 'year',
    stepmode: 'backward',
    count: 1,
    label: '1y'
  }, {
    step: 'all'
  }]
};
