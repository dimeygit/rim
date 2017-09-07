const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

const {ipcMain} = require('electron');


const path = require('path');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;

//let server = require('./server/server.js');


let db = new sqlite3.Database('./rim.sqlite');



function createWindow () {
  mainWindow = new BrowserWindow({width: 1100, height: 650, minWidth: 920, minHeight: 650});


  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
    mainWindow.setMenu(null);

    mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
});


ipcMain.on('IpcToMain', (event, arg) => {
    switch (arg.cmd){
        case 'getAllClients':
            db.all("select * from clients order by surname asc", function(err,rows)
            {
                mainWindow.webContents.send('getAllClients', { rows: rows});
            });
            break;
        case 'searchBtnClicked':
            db.all("select * from clients where surname like '%'||$name||'%' or phone like '%'||$name||'%'", {$name: arg.query}, function(err,rows)
            {
                mainWindow.webContents.send('getClients', { rows: rows});
            });
        break;
        case 'addNewClient':
            db.run("insert into clients values (NULL,$name,$surname,$patronymics,$phone, date('now'), 0)",
                {
                    $name: arg.data.name,
                    $surname: arg.data.surname,
                    $patronymics: arg.data.patronymics,
                    $phone: arg.data.phone
                }
            );
        break;
        case 'getCurrentClient':
            db.get("select * from clients where id = $id",
                {
                    $id: arg.id
                },
                function(err, row){
                    mainWindow.webContents.send('getCurrentClient', { row: row});
                }
            );

            break;
        case 'addNewSub':
            db.run("insert into subscriptions values (NULL,$id_client,$type,$visits,$d_start, $d_end, $cost, $trainer)",
                {
                    $id_client: arg.data.id_client,
                    $type: arg.data.type,
                    $visits: arg.data.visits,
                    $d_start: arg.data.date_start,
                    $d_end: arg.data.date_end,
                    $cost: arg.data.cost,
                    $trainer: arg.data.trainer
                }
            );
            break;
        case 'getAllSub':
            db.all("select * from subscriptions where id_client = $id order by d_start desc", {$id: arg.id_client}, function(err,rows)
            {
                mainWindow.webContents.send('getAllSub', { rows: rows});
            });
            break;
        case "getAllProductsType":
            db.all("select * from product_type",function(err,rows)
            {
                mainWindow.webContents.send('getAllProductsType', { rows: rows});
            });
            break;
        case 'addNewProduct':
            db.run("insert into products values (NULL,$id_type,$title,1)",
                {
                    $id_type: arg.data.type,
                    $title: arg.data.product
                }
            );
            break;
        case 'getAllProducts':
            db.all('select pa.id,pa.count,pa.amount, pa.cost, pa.date,p.title, pt.id as "id_type"  from product_amount pa join products p on pa.id_product = p.id join product_type pt on pt.id = p.id_type where pa.amount > 0 order by p.title asc',
                function(err,rows)
                {
                    mainWindow.webContents.send('getAllProducts', { data: rows});
                });
            break;
        case 'getInvoiceProducts':
            db.all('select * from products order by title asc', function(err,rows){
                mainWindow.webContents.send('getInvoiceProducts', {data: rows});
            });
            break;
        case 'getInvoiceUnits':
            db.all('select * from units order by unit asc', function(err,rows){
                mainWindow.webContents.send('getInvoiceUnits', {data: rows});
            });
            break;
        case 'addNewInvoice':
            db.run('insert into product_amount values (NULL, $product, $count, $count, $units, date("now"), $cost)',
                {
                    $product: arg.invoice.product,
                    $count: arg.invoice.count,
                    $units: arg.invoice.units,
                    $cost: arg.invoice.cost
                });
            break;
        case 'addNewSpending':
            db.run('insert into spending values (NULL, $title, date("now"), $cost)',
                {
                    $title: arg.data.direction,
                    $cost: arg.data.cost
                });
            break;
        case 'getLastCheck':
            db.get('select max(check_num) as number from chck', function(err,rows){
               mainWindow.webContents.send('getLastCheck',{data:rows});
            });
            break;
        case 'addNewInvoiceToCheck':
            db.run('insert into chck values (NULL, $check_num, $id_invoice, $count, $sum, date("now"), $cash, $change, $comment)',
                {
                    $check_num: arg.data.check_num,
                    $id_invoice: arg.data.id_invoice,
                    $count: arg.data.count,
                    $sum: arg.data.sum,
                    $cash: arg.data.cash,
                    $change: arg.data.change,
                    $comment: arg.data.comment
                });
            db.run('update product_amount set amount = amount - $count where id = $id_invoice',
                {
                    $count: arg.data.count,
                    $id_invoice: arg.data.id_invoice
                });
            break;
        case 'getSubsSale':
            db.all('select  c.surname, c.name, sub.type, sub.visits, sub.cost from subscriptions sub join clients c on  c.id = sub.id_client where sub.d_start = date("now")', function(err,rows){
                mainWindow.webContents.send('getSubsSale',{subscriptions : rows});
            });
            break;
        case 'getCashSale':
            db.all('select ch.check_num, p.title, ch.count, sum from chck ch  join product_amount pa on ch.id_invoice = pa.id  join products p on p.id = pa.id_product where ch.date = date("now")', function(err,rows){
                mainWindow.webContents.send('getCashSale',{chck : rows});
            });
            break;
        case 'getCheckSum':
            db.all('select check_num, sum(sum) as sm from chck where date = date("now") group by check_num', function(err,rows){
                mainWindow.webContents.send('getCheckSum',{chck_sum : rows});
            });
        case 'getCosts':
            db.all('select * from spending where date = date("now")', function(err,rows){
                mainWindow.webContents.send('getCosts',{costs : rows});
            });
            break;
        case 'getLastShift':
            db.all('SELECT  * FROM  shift ORDER BY  id DESC LIMIT 1', function(err,rows){
                mainWindow.webContents.send('getLastShift',{last : rows});
            });
            break;
    }
});


