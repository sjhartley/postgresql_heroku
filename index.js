const DATABASE_URL=process.env.DATABASE_URL;
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// pool.query(`INSERT INTO Users(FirstName,LastName)VALUES($1,$2)`, ['Jim','Bob'], (err, res) => {
//     if (err) {
//         console.log("Error - Failed to insert data into Users");
//         console.log(err);
//     }
//     else{
//       console.log("added entry...");
//     }
// });

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const port = process.env.PORT || 5000;
const cors = require("cors");
const app = express();


var get_options = {
  method: "GET",
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0"
  }
};

var post_options = {
  method: "POST",
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0"
  }
};

function tag_remover(str) {
  if (str.search(/\</i) !== -1) {
    while (str.search(/\</i) !== -1) {
      var bracket_pos_1 = str.search(/\</i);
      var bracket_pos_2 = str.search(/\>/i);
      var str_remove = str.slice(bracket_pos_1, bracket_pos_2 + 1);
      str = str.replace(str_remove, "");
    }
  }
  return str;
}

function nyse_get() {
  return new Promise(function (resolve, reject) {
    var url = "https://www.nyse.com/api/quotes/filter";
    var payload = {
      instrumentType: "EQUITY",
      pageNumber: 1,
      sortColumn: "NORMALIZED_TICKER",
      sortOrder: "ASC",
      maxResultsPerPage: 10,
      filterToken: ""
    };
    post_options.url = url;
    post_options.data = payload;

    axios(post_options)
      .then(function (response) {
        var data = response.data;
        console.log(data);
        //retrieve the total number of entries
        var total = data[0].total;
        console.log(`total: ${total}`);
        //alter the payload so that all entries can be accessed
        payload["maxResultsPerPage"] = total;
      })
      .then(function () {
        //a HTTP POST request is required
        post_options.data = payload;
        var arr = [];
        axios(post_options).then(function (response) {
          var data = response.data;
          for (var i = 0; i < data.length; i++) {
            //if the keyword entered by the user matches the company name or ticker
            //console.log(i);
            //console.log(`${data[i]["instrumentName"]}`);
            //console.log(`${data[i]["symbolTicker"]}`);
            let obj = new Object();
            obj["name"] = data[i]["instrumentName"];
            obj["ticker"] = data[i]["symbolTicker"];
            obj["url"] = data[i]["url"];
            arr.push(obj);
          }
          resolve(arr);
        });
      });
  });
}

function snapshot_get(ticker, session_key, cbid) {
  var url = `https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;

  get_options.url = url;

  axios(get_options).then(function (response) {
    var body = response.data;
    var new_line_split = body.split("\n");

    var data_arr = [];
    for (var i = 0; i < new_line_split.length; i++) {
      if (new_line_split[i].search("=") !== -1) {
        var dataObj = new Object();
        dataObj[new_line_split[i].split("=")[0]] = new_line_split[i].split(
          "="
        )[1];
        data_arr.push(dataObj);
      }
    }
    console.log(data_arr);
  });
}

function dataset_fetch(dataset, ticker, session_key, cbid) {
  var dataUrl_start =
    "https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
  var dataUrl_end = `&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

  var dataUrl = `${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
  console.log(dataUrl);

  get_options.url = dataUrl;

  axios(get_options).then(function (response) {
    var data = response.data;
    console.log(data);
  });
}

function storeTickers(tickers) {
  //console.log(tickers);
  pool.query(
    "CREATE TABLE if not exists tickers (name TEXT, ticker TEXT, url TEXT)"
  );

  for (var i = 0; i < tickers.length; i++) {
    console.log(tickers[i]["name"]);
    console.log(tickers[i]["ticker"]);
    console.log(tickers[i]["url"]);
    //stmt_1.run(tickers[i]["name"], tickers[i]["ticker"], tickers[i]["url"]);
    const ticker = tickers[i]["ticker"];
    const idx = i;
    pool.query(
      `INSERT INTO tickers(name, ticker, url)VALUES($1,$2,$3)`,
      [tickers[i]["name"], tickers[i]["ticker"], tickers[i]["url"]],
      function (err, res) {
        if (err) {
          console.log("Error inserting data into table");
        } else {
          console.log(`added entry for${ticker}`);
        }

        if (idx === tickers.length - 1) {
          console.log("Done...");
          pool.end();
        }
      }
    );
  }
  //console.log("Please wait...");
}

function table_exist(){
  pool.query("SELECT * from tickers;", function(err, res){
    if(err){
      console.log("TABLE DOES NOT EXIST");
      console.log(err);
      nyse_get().then(function (tickers) {
        storeTickers(tickers);
      });
    }
    else{
      console.log("TABLE EXISTS...");
      console.log(res.rows);
    }
  });
}

table_exist();

app.use(bodyParser.urlencoded({ extended: false }));

app.get("/list", (req, res) => {
  pool.query("SELECT * from tickers;", function(err, query_res){
    if(err){
      console.log("TABLE DOES NOT EXIST");
      console.log(err);
      res.send("TABLE DOES NOT EXIST");
    }
    else{
      console.log("TABLE EXISTS...");
      console.log(query_res.rows);
      res.send(query_res.rows);
    }
  });
});

app.listen(port, function () {
  console.log(`server running at port: ${port}`);
});

// nyse_get().then(function (tickers) {
//   storeTickers(tickers);
// });

//pool.end();
//console.log("Done...");
