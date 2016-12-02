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

  document.getElementById('loading').style.display = 'none';
  document.getElementById('logo-pryv').style.display = 'initial';
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

  document.getElementById('loading').style.display = 'initial';
  document.getElementById('logo-pryv').style.display = 'none';
  var filter = new pryv.Filter({fromTime: 12});
  monitor = connection.monitor(filter);

  // should be false by default, will be updated in next lib version
  // to use fullCache call connection.ensureStructureFetched before
  monitor.ensureFullCache = false;
  monitor.initWithPrefetch = 0; // default = 100;

  // get notified when monitoring starts
  monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_LOAD, function (events) {

    document.getElementById('loading').style.display = 'none';
    document.getElementById('logo-pryv').style.display = 'initial';
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
    gaps: 60,
    trace: {
      name: 'Heartrate',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-spo2_ratio/percent' : {
    gaps: 60,
    trace: {
      name: 'Oxygen Saturation',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'activity' : {
    gaps: 60,
    trace: {
      name: 'Activity',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-bpw_count/generic' : {
    gaps: 60,
    trace: {
      name: 'Blood Pulse Wave',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-blood-perfusion' : {
    gaps: 60,
    trace: {
      name: 'Perfusion Index',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'skin-temperature' : {
    gaps: 60,
    trace: {
      name: 'Skin Temperature',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-steps_frequency/hz' : {
    gaps: 60,
    trace: {
      name: 'Steps',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'heart-rate-variability' : {
    gaps: 60,
    trace: {
      name: 'Heart Rate Variability',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-respiration-rate_frequency/bpm' : {
    gaps: 60,
    trace: {
      name: 'Respiratory rate',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  },
  'biovotion-energy-expenditure_energy/ws' : {
    gaps: 60,
    trace: {
      name: 'Energy expenditure',
      mode: 'lines',
      connectgaps: false,
      type: 'scatter'
    }
  }

};

var plots = {
};

function getDateString(timestamp) {
  var date = new Date(timestamp);
  return date.toISOString().substring(0, 10) + ' '  +
    date.toISOString().substring(11, 19) + '.' + date.getMilliseconds();
}

function createTrace(event) {
  var traceKey = event.streamId + '_' + event.type;


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
    rangeselector: selectorOptions,
    title: 'Time',
    type: 'date',
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

var lastLastX = 0;
var gap = 1 * 30 * 1000;

function initOrRedraw(traceKey) {

  var trace = traces[traceKey];
  if (initializedTraces[traceKey]) {

    // get last


    if (liveRange && (lastX  > (lastLastX + gap))) {
      var start = lastX - liveRange * 60 * 1000;
      var stop = lastX + 1 * 30 * 1000;
      lastLastX = lastX;
      setAllRanges(getDateString(start), getDateString(stop));
      previousWasLiverange = true;
    }

    return Plotly.redraw(trace.plotKey);
  }
  initializedTraces[traceKey] = true;

  if (! initializedPlots[trace.plotKey]) {
    initializedPlots[trace.plotKey] = true;
    Plotly.newPlot(trace.plotKey, [], plots[trace.plotKey].layout);
    document.getElementById(trace.plotKey+'-div').style.display = 'inline-block';
  }


  Plotly.relayout(trace.plotKey, trace.layout);
  Plotly.addTraces(trace.plotKey, [trace.trace]);

}

var lastX = 0;
var liveRange = 0;


var ignoreFrom = ((new Date().getTime())) - (60 * 60 * 24 * 1000 * 10);

function updatePlot(events) {
  // needed ?
  events = events.sort(function (a, b) {
    return a.time - b.time;
  });

  var toRedraw = {};

  events.map(function (event) {
    var traceKey = event.streamId + '_' + event.type;

    if (! pryv.eventTypes.isNumerical(event)) {
      traces[traceKey] = { ignore : true};
      //console.log('Ignore', event);
      return;
    }

    if (event.trashed || (ignoreFrom > event.timeLT)) {
    //  console.log(new Date(ignoreFrom), new Date(event.timeLT), ignoreFrom, event.timeLT, ignoreFrom - event.timeLT);

    return;
    }
    //console.log(new Date(event.timeLT));


    if (! traces[traceKey]) { // create New Trace
      createTrace(event);

    }

    if (! traces[traceKey].ignore) {


      if (traces[traceKey].gaps) {
        if ((event.timeLT - traces[traceKey].last) > traces[traceKey].gaps * 1000) {
          traces[traceKey].trace.x.push(getDateString(traces[traceKey].last + 1));
          traces[traceKey].trace.y.push(null);
        }
      }

      if (event.timeLT > lastX) {
        lastX = event.timeLT;
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

function setAllForRealTime () {
  var now = new Date().getTime();
  var start = now - 5 * 60 * 1000;
  var stop = now + 5 * 60 * 1000;
  setAllRanges(getDateString(start), getDateString(stop));
}

function setAllRanges(start, stop) {
  console.log('***', start, stop);
  Object.keys(plots).forEach(function (plotKey) {
    Plotly.relayout(plotKey, {xaxis: {range : [start, stop]}});
  });
}


function resetPlots() {
  if (monitor) {
    monitor.destroy();
  }
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}


// *** Plotly designs ***  //
var selectorOptions = {
  buttons: [
    {
      step: 'hour',
      stepmode: 'backward',
      count: 1,
      label: '1h'
    }, {
      step: 'day',
      stepmode: 'backward',
      count: 1,
      label: '1d'
    }, {
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
    stepmode: 'backward',
    count: 1,
    label: '1y'
  }, {
    step: 'all'
  }]
};
