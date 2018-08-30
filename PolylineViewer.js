'use strict';


// create a named module to hold all our methods
var polylineViewer = {

  nameContains: function(name, searchString){
    return name.toLocaleLowerCase().indexOf(searchString.toLocaleLowerCase()) > -1;
  },

  getUserPolylines: function () {
    var nSheets = polylineViewer.checkForAvailableSheets() ;
    this.log("saved sheet name? '" + polylineViewer.savedSheetName + "'");
    if (nSheets == 0){
      return;
    } else if (polylineViewer.savedSheetName) {
      $('#show_choose_sheet_button').hide();
      this.loadSelectedMarks(polylineViewer.savedSheetName);
    } else if (nSheets == 1) {
      this.selectSheetAndRun(tableau.extensions.dashboardContent.dashboard.worksheets[0].name);
    } else {
      this.showChooseSheetDialog();
    }
  },

  sheetData: [],

  getDataFromSheet: function (worksheet){

    return worksheet.getSelectedMarksAsync().then(function(marks) {
      polylineViewer.sheetData = []; // clear any existing selection

      const worksheetData = marks.data[0]; // it's the first table, unless you have a dual-axis chart
      polylineViewer.log("got selected data: " + " with " + worksheetData.columns.length + " columns")
      polylineViewer.log(worksheetData)

      if(worksheetData.columns.length == 0){
        $('#no_data_message').show();
        return null;
      }
      // we need to capture the polyline and the activity Id
      //activityIdField = "Activity ID";
      //polylineField = "Map Summary Polyline";
      var field = worksheetData.columns.find(column => polylineViewer.nameContains(column.fieldName, "polyline"));
      if (!field){
        alert("Could not find a column of polylines. Make sure you have a column name including the word 'polyline' in your data.")
        return;
      }
      var selectedId = worksheetData.columns.find(column => polylineViewer.nameContains(column.fieldName,"activity"));
      if (!selectedId){ // just find something to label it with
        selectedId = worksheetData.columns.find(column => polylineViewer.nameContains(column.fieldName,"name"));
      }
      if (!selectedId){ // fine, be that way
        selectedId = worksheetData.columns.find(column => polylineViewer.nameContains(column.fieldName,"polyline"));
      }

      polylineViewer.log("polyline field is " + field.index);
      polylineViewer.log(field);
      for (let row of worksheetData.data) {
        polylineViewer.log("pushing to selected list: ")
        polylineViewer.log(row);
        polylineViewer.sheetData.push({id: row[selectedId.index].value, polyline: row[field.index].value});
      }
      polylineViewer.log(polylineViewer.sheetData[0]);

      if (polylineViewer.sheetData.length > 0) {
        $('#no_data_message').hide();
      } else {
        $('#no_data_message').show();
      }
      return polylineViewer.sheetData;

    });

  },

  map: null,
  routesDisplayed: null,
  initMap: function() {
    polylineViewer.log("initMap");
    polylineViewer.map = new L.Map("map", {
        zoom: 12
    });
    // Maps on OpenStreetMap using https://gist.github.com/mneedham/34b923beb7fd72f8fe6ee433c2b27d73
    // updated to current leaflet with https://stackoverflow.com/a/48876054/422315
    var tileLayer = new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.{ext}', {
       attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
       subdomains: 'abcd',
       minZoom: 0,
       maxZoom: 20,
       ext: 'png'
    });

    polylineViewer.map.addLayer(tileLayer);
  },

  displayMap: function  (encodedRoutes) {
    polylineViewer.log("displayMap")
    if (!polylineViewer.map){
      polylineViewer.initMap();
    }
    if (polylineViewer.routesDisplayed) {
      polylineViewer.map.removeLayer(polylineViewer.routesDisplayed);
    }
    if (!encodedRoutes){
      polylineViewer.log("no route passed to map");
      return;
    }
    polylineViewer.log("display route " + encodedRoutes)
    var coordinates = [];
    var firstPoint = null;

    for (let encoded of encodedRoutes) {
      var routeLine = L.Polyline.fromEncoded(encoded.polyline);
      // todo - make the color different for each id?
      coordinates = routeLine.getLatLngs();
      polylineViewer.routesDisplayed = L.polyline(
          coordinates,
          {
              color: 'red',
              weight: 2,
              opacity: .7,
              lineJoin: 'round'
          }
      )
      polylineViewer.routesDisplayed.bindTooltip(encoded.id);
      polylineViewer.routesDisplayed.addTo(polylineViewer.map);
    }

    polylineViewer.map.fitBounds(coordinates);
  },



  /* hides the choose sheet UI */
  hideSelectSheetDialog: function () {
    $('#choose_sheet_dialog').css("visibility", "collapse")
  },
  /**
   * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
   */
  showChooseSheetDialog: function  () {

    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
    this.log("finding sheets!");
    // Clear out the existing list of sheets
    // we loop through all of these worksheets and add buttons for each one

    $('#choose_sheet_buttons').empty();
    worksheets.forEach(function (worksheet) {
      // Declare our new button which contains the sheet name
      const button = polylineViewer.createButton(worksheet.name);

      // Create an event handler for when this button is clicked
      button.click(function () {
        // Get the worksheet name and save it to settings.
        const worksheetName = worksheet.name;
        polylineViewer.loadSelectedMarks(worksheetName);
          selectSheetAndRun(worksheetName).then(function () {
            // Once the save has completed, close the dialog and show the data table for this worksheet
            polylineViewer.hideSelectSheetDialog();
            polylineViewer.log("settings saved!");
        });
      });

      // Add our button to the list of worksheets to choose from
      $('#choose_sheet_buttons').append(button);
    });

    // now we've built all the buttons, display it
    $('#choose_sheet_dialog').css("visibility", "visible")

  },

  savedSheetName: tableau.extensions.settings && tableau.extensions.settings.get('sheet'),
  selectSheetAndRun: function(worksheetName){
    polylineViewer.replaceSelectButtonWithName(worksheetName);
    tableau.extensions.settings ? tableau.extensions.settings.set('sheet', worksheetName) : {} ;
    polylineViewer.savedSheetName = worksheetName;
    polylineViewer.log("sheet chosen: " + worksheetName);
    polylineViewer.replaceSelectButtonWithName(worksheetName);
    polylineViewer.loadSelectedMarks(worksheetName);
    return tableau.extensions.settings ?
       tableau.extensions.settings.saveAsync()
      :Promise.resolve();
  },

  createButton: function  (buttonTitle) {
    const button =
    $(`<button type='button' class='btn btn-default btn-block'>
      ${buttonTitle}
    </button>`);

    return button;
  },

  // This variable will save off the function we can call to unregister listening to marks-selected events
  unregisterEventHandlerFunction: function() {},

  loadSelectedMarks: function  (worksheetName) {
    // Remove any existing event listeners
    if (this.unregisterEventHandlerFunction) {
      this.unregisterEventHandlerFunction();
    }
    polylineViewer.log("loadSelectedMarks " + worksheetName);
    // Get the worksheet object we want to get the selected marks for
    const worksheet = this.getSelectedSheet(worksheetName);
    if (!worksheet) {
      polylineViewer.log("no sheet could be selected");
      return;
    }

    // look at the marks to get the activity id and the polyline?
    this.getDataFromSheet(worksheet).then(
      function(polylineData){
        polylineViewer.displayMap(polylineData);
      });

    // Add an event listener for the selection changed event on this sheet.
    this.unregisterEventHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, function (selectionEvent) {
      // When the selection changes, reload the data
      polylineViewer.log("mark selection changed");
      polylineViewer.loadSelectedMarks(worksheetName);
    });
  },

  checkForAvailableSheets: function() {
    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    if (worksheets.length == 0) {
      $('#selected_marks_title').hide();
      alert("No sheets found on the dashboard");
      return false;
    } else {
      return worksheets.length;
    }
  },

  initializeButtonsAndTitles: function(nSheets) {
    // Set the dashboard's name in the title
    const dashboardName = tableau.extensions.dashboardContent.dashboard.name
    $('#choose_sheet_title').text(dashboardName);
    if (nSheets == 1){
      this.replaceSelectButtonWithName(tableau.extensions.dashboardContent.dashboard.worksheets[0].name);
    } else {
      this.log("attaching methods");
      $('#show_choose_sheet_button').click(this.showChooseSheetDialog);
      $('#close_choose_sheet').click(this.hideSelectSheetDialog);
    }
  },

  replaceSelectButtonWithName: function(sheetName){
    polylineViewer.hideSelectSheetDialog();
    $('#chosen_sheet_name').text(sheetName);
    $('#chosen_sheet_name').show();
  },

  getSelectedSheet: function  (worksheetName) {
    if (!worksheetName) {
      worksheetName = tableau.extensions.settings.get('sheet');
    }
    if (!worksheetName){
      alert("There is no sheet matching the expected name");
      return null;
    }
    // Go through all the worksheets in the dashboard and find the one we want
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) {
      return sheet.name === worksheetName;
    });
  },

  log: function (message) {
    console.log(message);
    //$('#no_data_message').show()
    //$('#no_data_message').append("<p>" + message + "</p>");
  }

};

function mockTableau(){
  polylineViewer.log("faking a dashboard");
  tableau.extensions = {};
  tableau.extensions.dashboardContent = {}

  var selectedMarksReturnValue = {
    data: [
      { columns: [
        {
          index: 0,
          fieldName: 'polylineSamples',
          data: [
            [{value: 'ypyaHhaxiV_BfDxCcN{As@d@uFvR?}AbFPn{@ps@z@DwGjMGd@aGpTV^mB~Dk@'}],
            [{value: 'ujsaHjdsiV_C`@M~s@iAbIei@Z{U|LaPd@_T{CwQbC_a@rVcHfVeE~GsRGiAtHfBjAsCnH'}]
          ]
        },
        {
          index: 1,
          fieldName: 'detailText',
          data: [[{value: 'bikebike'}], [{value: 'tricycle'}]]
        },
        {
          index: 2,
          fieldName: 'activity_id',
          data: [1,2]
        }
      ],
      data: [[1,2,3],[4,5,6],[7,8,9]]
    },
    ]
  }
  var  worksheet = {
    name: 'fake sheet',
    addEventListener:function () { polylineViewer.log("event")},
    getSelectedMarksAsync: function(){ return Promise.resolve(selectedMarksReturnValue)},
    getUnderlyingDataAsync: function() {return Promise.resolve({data:2})}
  }
  tableau.extensions.dashboardContent.dashboard = {
    name: "fake dashboard",
    worksheets: [ worksheet ]
  }
}

// Wrap in an anonymous function to avoid polluting the global namespace
(function() {
  $(document).ready(function () {


    polylineViewer.initMap();
    tableau.extensions.initializeAsync()
    .then(
      function () {
        polylineViewer.getUserPolylines();
      },
      function(err){
        console.this.log("Tableau could not be initialized: " + err);
        polylineViewer.log(err)
      }
    )
    .catch(
      function(err){
        console.log("(Outer catch) Tableau could not be initialized: " + err);
        polylineViewer.log(err);
    })
/*
    mockTableau();
    polylineViewer.getUserPolylines();
 */
  })

})();
