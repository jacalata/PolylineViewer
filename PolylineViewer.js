'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function ()
{
  $(document).ready(function () {
      initializeButtons();
      hideSelectSheetDialog();
      tableau.extensions.initializeAsync()
      .catch(function(err) {
        console.log(err);
        log(err)
      })
      .then(
        function () {
          $('#no_data_message').hide();
          getUserPolylines();
        }
      );
    })


  function getUserPolylines() {

      let savedSheetName = tableau.extensions.settings && tableau.extensions.settings.get('sheet');

      if (savedSheetName) {
        loadSelectedMarks();
      } else {
        showChooseSheetDialog();
      }
  }

  function getDataFromSheet(worksheet){

    let polylines = [];
    let list = [];
    worksheet.getSelectedMarksAsync().then(function(marks) {
      const worksheetData= marks.data[0]; // usually it's the first table?
      log("got selected marks: " + worksheetData + " with " + worksheetData.columns.length + " colulmns")

      // we need to capture the polyline and the activity Id
      //activityIdField = "Activity ID";
      //polylineField = "Map Summary Polyline";
     // let field = worksheetData.columns[0]; //.find(column => column.fieldName === "Map Summary Polyline");
      log("column 0 is " + worksheetData.columns[0].fieldName)
       log("column 1 is " + worksheetData.columns[1].fieldName)
       log("column 2 is " + worksheetData.columns[2].fieldName)
      for (let row of worksheetData.columns[0].data) {
        list.push(row[field.index].value);
      }
      log(list[0]);
 //     polylines = list.filter((el, i, arr) => arr.indexOf(el) === i);
    });
    return list;
  }

  function hideSelectSheetDialog() {
    $('#choose_sheet_dialog').hide()
  }

  function displayMap (encodedRoutes) {

      if (!encodedRoutes) {  //browser debugging
        encodedRoutes = ['_p~iF~ps|U_ulLnnqC_mqNvxq`@' ]
      }
      var coordinates = [];
      var firstPoint = null;

      // Maps on OpenStreetMap using mneedham https://gist.github.com/mneedham/34b923beb7fd72f8fe6ee433c2b27d73
      var tileLayer = new L.StamenTileLayer("toner");
      var map = new L.Map("map", {
          zoom: 12
      });

      for (let encoded of encodedRoutes) {
        var polyline = L.Polyline.fromEncoded(encoded);
        coordinates = polyline.getLatLngs();
        var routeLine = L.polyline(
            coordinates,
            {
                color: 'blue',
                weight: 2,
                opacity: .7,
                lineJoin: 'round'
            }
        )
        routeLine.addTo(map);
      }

      map.fitBounds(coordinates);
      map.addLayer(tileLayer);
  };

  /**
   * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
   */
  function showChooseSheetDialog () {

    log("finding sheets!");
    // Clear out the existing list of sheets
    $('#choose_sheet_buttons').empty();

    // Set the dashboard's name in the title
    if (!tableau.extensions.dashboardContent) {
      log("faking a dashboard");
      tableau.extensions = {};
      tableau.extensions.dashboardContent = {}
      tableau.extensions.dashboardContent.dashboard = {
        name: "fake",
        worksheets: []
      }
    }
    const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
    $('#choose_sheet_title').text(dashboardName);

    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    if (worksheets.length == 1){
       log("only one sheet, don't bug the user");
       loadSelectedMarks(worksheets[0].name);
       return;
    }
    // Next, we loop through all of these worksheets and add buttons for each one
    worksheets.forEach(function (worksheet) {
      // Declare our new button which contains the sheet name
      const button = createButton(worksheet.name);

      // Create an event handler for when this button is clicked
      button.click(function () {
        // Get the worksheet name and save it to settings.
        filteredColumns = [];
        const worksheetName = worksheet.name;
        tableau.extensions.settings.set('sheet', worksheetName);
        $('#choose_sheet_dialog').hide();
        log("sheet chosen");
        loadSelectedMarks(worksheetName);
        tableau.extensions.settings.saveAsync().then(function () {
          // Once the save has completed, close the dialog and show the data table for this worksheet
          $('#choose_sheet_dialog').hide();
          log("settings saved!");
        });
      });

      // Add our button to the list of worksheets to choose from
      $('#choose_sheet_buttons').append(button);
    });

    $('#choose_sheet_dialog').show()

  }

  function createButton (buttonTitle) {
    const button =
    $(`<button type='button' class='btn btn-default btn-block'>
      ${buttonTitle}
    </button>`);

    return button;
  }

  // This variable will save off the function we can call to unregister listening to marks-selected events
  let unregisterEventHandlerFunction;

  function loadSelectedMarks (worksheetName) {
    // Remove any existing event listeners
    if (unregisterEventHandlerFunction) {
      unregisterEventHandlerFunction();
    }

    // Get the worksheet object we want to get the selected marks for
    const worksheet = getSelectedSheet(worksheetName);

    // look at the marks to get the activity id and the polyline?
   getDataFromSheet(worksheet);
   //populateDataTable(worksheet);

    // Add an event listener for the selection changed event on this sheet.
    unregisterEventHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, function (selectionEvent) {
      // When the selection changes, reload the data
      loadSelectedMarks(worksheetName);
    });
  }


  function populateDataTable (worksheet) {

    log("populating data from " + worksheet.name);
    worksheet.getUnderlyingDataAsync().then(function(data) {
      // Do some UI setup here: change the visible section and reinitialize the table
      $('#data_table_wrapper').empty();

      log("got underlying data " + data);

      if (data.totalRowCount > 0) {
        $('#no_data_message').hide();

        log("this much data! " + data.totalRowCount);
        $('#data_table_wrapper').append(`<table id='data_table' class='table table-striped table-bordered'></table>`);

        // Do some math to compute the height we want the data table to be
        var top = $('#data_table_wrapper')[0].getBoundingClientRect().top;
        var height = $(document).height() - top - 130;

        // Initialize our data table with what we just gathered
        $('#data_table').DataTable({
          data: data,
          columns: columns,
          autoWidth: false,
          deferRender: true,
          scroller: true,
          scrollY: height,
          scrollX: true,
          dom: "<'row'<'col-sm-6'i><'col-sm-6'f>><'row'<'col-sm-12'tr>>" // Do some custom styling
        });
      } else {
          log("data length 0 :(");
      }
    })
  }


  function initializeButtons () {
    $('#show_choose_sheet_button').click(showChooseSheetDialog);
    $('#close_choose_sheet').click(hideSelectSheetDialog);
  }

  function getSelectedSheet (worksheetName) {
    if (!worksheetName) {
      worksheetName = tableau.extensions.settings.get('sheet');
    }

    // Go through all the worksheets in the dashboard and find the one we want
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) {
      return sheet.name === worksheetName;
    });
  }

  function log(message) {
    $('#no_data_message').show()
    $('#no_data_message').append("<p>" + message + "</p>");
  }


})();

