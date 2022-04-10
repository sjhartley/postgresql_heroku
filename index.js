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

function dataset_fetch(dataset, ticker, session_key, cbid){
  return new Promise(function(resolve, reject){
    var dataUrl_start="https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
    var dataUrl_end=`&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

    var dataUrl=`${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
    console.log(dataUrl);

    get_options.url=dataUrl;

    axios(get_options).then(function(response){
      var data=response.data;
      console.log(data);
      resolve(data);
    }).catch(function(err){
      //res.send("CANNOT ACCESS DATA AT THIS TIME");
      return false;
    });;
  });
}

function snapshot_get(ticker, session_key, cbid){
  return new Promise(function(resolve, reject){
    var url=`https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;
    get_options.url=url;
    axios(get_options).then(function(response){
      var body=response.data;
      var new_line_split=body.split('\n');

      var data_arr=[];
      var dataObj=new Object();
      for(var i=0; i<new_line_split.length; i++){
        if(new_line_split[i].search("=") !== -1){
          //var dataObj=new Object();
          dataObj[new_line_split[i].split('=')[0]]=new_line_split[i].split('=')[1];
          //data_arr.push(dataObj);
        }
      }
      //console.log(dataObj);
      //res.send(data_arr);
      resolve(dataObj);
    }).catch(function(err){
      resolve("CANNOT ACCESS DATA AT THIS TIME");
      return false;
    });;

  });
}

function nyse_get(keyWord, exp_res){

  return new Promise(function(resolve, reject){

    let sql=`SELECT * FROM tickers WHERE ticker=$1`;
    let ticker=keyWord.toUpperCase();

    //check if ticker exists in tickers table
    pool.query(sql, [ticker],(err, res) => {
      if (err) {
        console.error(`There is error, ${err.message}`);
        exp_res.send("Ticker does not exist in tickers table");
      }
      else{
        //exp_res.send(res.rows[0]);
        console.log(`Ticker ${ticker} has been found...`);
        //this url is used to obtain the authentication key
        var td_url="https://www.nyse.com/api/idc/td";

        //to authenticate we must insert the key into the authentication url
        var authUrl_start="https://nyse.widgets.dataservices.theice.com/Login?auth=";
        var authUrl_end="&browser=false&client=mobile&callback=__gwt_jsonp__.P0.onSuccess";

        axios.get(td_url).then(function(response){
          var data=response.data;
          console.log(response.headers);
          var auth=data['td'].toString().split('=')[0];
          var search_chars=['/', '\\+'];
          console.log(auth);

          //the authentication key needs to be encoded before it can be used
          auth=encodeURIComponent(auth);

          console.log(`auth=${auth}`);
          //insert the encoded authentication key
          var auth_url=`${authUrl_start}${auth}${authUrl_end}`;
          console.log(`auth_url: ${auth_url}`);

          get_options.url=auth_url;

          axios(get_options).then(function(response){
            var data=response.data.toString();
            console.log(data);
            //obtain cbid
            var cbid=data.split('"cbid":')[1].split('"')[1];
            console.log(cbid);
            var search_chars=['/', '\\+'];
            //obtain session key
            var session_key=encodeURIComponent(data.split('"webserversession":')[1].split('"')[1].split(',')[1].split('=')[0], search_chars);
            console.log(session_key);

            let promises=[];

            // var datasets=["MQ_Fundamentals", "DividendsHistory"];
            // for(var i=0; i<datasets.length; i++){
            //   console.log(`datasets=${datasets[i]}\n\n\n`);
            //   promises.push(dataset_fetch(datasets[i], ticker, session_key, cbid));
            // }

            promises.push(snapshot_get(ticker, session_key, cbid));

            Promise.all(promises).then(function(result){
              console.log(result);
              console.log("sending...");
              //exp_res.send(result);
              resolve(result);
            });

          }).catch(function(err){
            reject("CANNOT ACCESS DATA AT THIS TIME");
            return false;
          });;
        }).catch(function(err){
          reject("CANNOT ACCESS DATA AT THIS TIME");
          return false;
        });;
      }
    });

  }).then(function(response){
    console.log("\n\n\n\nRESULT\n\n");
    console.log(response);
    resolve(response);
  });

}

function nyse_get1() {
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
      nyse_get1().then(function (tickers) {
        storeTickers(tickers);
      });
    }
    else{
      console.log("TABLE EXISTS...");
      console.log(res.rows);
    }
  });
}

function add_Watch(keyWord, exp_res){
  let sql=`SELECT * FROM tickers WHERE ticker=$1`;
  let ticker=keyWord.toUpperCase();

  let tickerTableprom=new Promise(function(resolve, reject){
      //check if ticker exists in tickers table
      pool.query(sql, [ticker],(err, res) => {
        if (err) {
          console.error(`There is error, ${err.message}`);
          exp_res.send("Ticker does not exist in tickers table");
          reject(false);
        }
        else{
          resolve(res);
        }
      });
  });

  tickerTableprom.then(function(res){
    if((res !== false) && (typeof res.rows[0] !== 'undefined')){
      //console.log(res.rows);
      //console.log("hello");

      var tickerObj=res.rows[0];
      console.log(tickerObj);

      pool.query("CREATE TABLE if not exists watchlist (name TEXT, ticker TEXT, url TEXT)");
      let sql=`SELECT * FROM watchlist WHERE ticker=$1`;
      let ticker=tickerObj.ticker;
      console.log(`ticker=${ticker}`);

      let watchlistTableprom=new Promise(function(resolve, reject){
        pool.query(`SELECT * FROM watchlist WHERE ticker=$1`, [tickerObj.ticker], function(err, res){
          console.log(res);
          console.log(res.rows.length);
          if(res.rows.length === 0){
            console.log("Error, ticker does not exist in watchlist table");
            resolve(tickerObj);
          }
          else{
            console.log("Ticker does exist in watchlist table");
            exp_res.send("Ticker does exist in watchlist table");
            reject(false);
          }
        });
      }).catch(function(rej){
        console.log("rej");
        console.log(rej);
        //pool.end();
        return false;
      });

      watchlistTableprom.then(function(res){
        console.log("res....");
        console.log(res);

        if(res !== false){
          var sql=`INSERT INTO watchlist(name, ticker, url)VALUES($1,$2,$3)`;
          console.log(res.name, res.ticker, res.url);
          pool.query(sql, [res.name, res.ticker, res.url], function(err, res){
            if(err){
              console.log("error inserting data...");
              exp_res.send("error inserting data...")
            }
            else{
              console.log("INSERTION SUCCESSFUL...");
              exp_res.send("INSERTION SUCCESSFUL...")
            }

          });
        }
        //pool.end();
      });
    }

      //pool.end();
  });


}

function del_Watch(keyWord, exp_res){
  let sql=`SELECT * FROM tickers WHERE ticker=$1`;
  let ticker=keyWord.toUpperCase();

  let prom=new Promise(function(resolve, reject){
      //check if ticker exists in tickers table
      pool.query(sql, [ticker],(err, res) => {
        if (err) {
          console.error(`There is error, ${err.message}`);
          exp_res.send("Ticker does not exist in tickers table");
          reject(false);
        }
        else{
          resolve(res);
        }
      });
  });

  prom.then(function(res){
    if((res !== false) && (typeof res.rows[0] !== 'undefined')){
      //console.log(res.rows);
      //console.log("hello");

      var tickerObj=res.rows[0];
      console.log(tickerObj);

      pool.query("CREATE TABLE if not exists watchlist (name TEXT, ticker TEXT, url TEXT)");
      let sql=`SELECT * FROM watchlist WHERE ticker=$1`;
      let ticker=tickerObj.ticker;
      console.log(`ticker=${ticker}`);

      let prom1=new Promise(function(resolve, reject){
        pool.query(`SELECT * FROM watchlist WHERE ticker=$1`, [tickerObj.ticker], function(err, res){
          console.log(res);
          console.log(res.rows.length);
          if(res.rows.length !== 0){
            console.log("ticker does exist in watchlist table and needs to be deleted");
            resolve(tickerObj);
          }
          else{
            console.log("Ticker does not exist in watchlist table");
            exp_res.send("Ticker does not exist in watchlist table");
            reject(false);
          }
        });
      }).catch(function(rej){
        console.log("rej");
        console.log(rej);
        //pool.end();
        return false;
      });

      prom1.then(function(res){
        console.log("res....");
        console.log(res);

        if(res !== false){
          var sql=`DELETE FROM watchlist WHERE ticker=$1`;
          console.log(res.name, res.ticker, res.url);
          pool.query(sql, [res.ticker], function(err, res){
            if(err){
              console.log("error deleting data...");
              exp_res.send("error deleting data...")
            }
            else{
              console.log("DELETION SUCCESSFUL...");
              exp_res.send("DELETION SUCCESSFUL...")
            }

          });
        }
        //pool.end();
      });
    }

      //pool.end();
  });
}

function searchList(keyWord, exp_res){
  let sql=`SELECT * FROM tickers WHERE ticker LIKE $1`;
  let ticker=keyWord.toUpperCase();

  //check if ticker exists in tickers table
  pool.query(sql, ['%'+ticker+'%'],(err, res) => {
    if (err) {
      console.error(`There is error, ${err.message}`);
      exp_res.send("Ticker does not exist in tickers table");
    }
    else{
      exp_res.send(res.rows);
    }
  });
}


table_exist();

app.use(cors());
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

app.get("/watchlist", (req, res) => {
  pool.query("SELECT * from watchlist;", function(err, query_res){
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

app.post("/add", (req, res) => {
  console.log(req.body.keyWord);
  add_Watch(req.body.keyWord, res);
});

app.post("/delete", (req, res) => {
    console.log(req.body.keyWord);
    del_Watch(req.body.keyWord, res);
});

app.post("/search", (req, res) => {
    console.log(req.body.keyWord);
    searchList(req.body.keyWord, res);
});

app.post("/nyse", (req, res) => {
  console.log(req.body.keyWord);
  nyse_get(req.body.keyWord, res);
});

app.listen(port, function () {
  console.log(`server running at port: ${port}`);
});

// nyse_get().then(function (tickers) {
//   storeTickers(tickers);
// });

//pool.end();
//console.log("Done...");
