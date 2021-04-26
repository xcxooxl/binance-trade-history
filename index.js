const ccxt = require("ccxt");
const ExcelJS = require("exceljs");
const client = new ccxt.binance({
    apiKey: '',
    secret: ''
});

const getSymbolTrades = async (symbol, startDate, limit) => {
    const myTrades = await client.fetchMyTrades(symbol, startDate, limit)
    const hasMoreTrades = myTrades.length === limit;
    if (hasMoreTrades) {
        const lastTrade = myTrades[myTrades.length - 1];
        const lastTradeId = lastTrade.id;
        return [...myTrades, await getSymbolTrades(symbol, lastTradeId, limit)]
    }
    return myTrades;
}

const getAllTrades = async (startDate = 0) => {
    const markets = await client.fetchMarkets()
    const limit = 50;
    const trades = [];
    let progress = 1;
    const totalMarkets = markets.length;
    for (const market of markets) {
        const symbolTrades = await getSymbolTrades(market.symbol, startDate, limit);
        trades.push.apply(trades, symbolTrades);
        const progressPercentage = (progress / totalMarkets * 100).toFixed(2);
        console.log(`${market.symbol} found ${symbolTrades.length} trades (${progress}/${totalMarkets}) ${progressPercentage}%`);
        progress++;
    }
    return trades;
}

const buildTradeMap = myTrades => {
    const tradesMap = myTrades.reduce((currencies, trade) => {
        const [buyCurrency, sellCurrency] = trade.symbol.split('/');
        if (!currencies[buyCurrency])
            currencies[buyCurrency] = [];

        currencies[buyCurrency].push(trade);
        return currencies;
        // const currencyName = trade.side === 'buy' ? buyCurrency : sellCurrency
    }, {})
    return tradesMap;
};

function centerAllLines(sheet) {
    const alignment = {vertical: 'middle', horizontal: 'center'};
    sheet.eachRow((row) => row.eachCell(cell => cell.alignment = alignment));
}

const addTradesToSheet = (workbook, trades, sheetName) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
        {header: 'Date', width: 24},
        {header: 'Side', width: 6},
        {header: 'Symbol', width: 12},
        {header: 'Price', width: 13},
        {header: 'Amount', width: 13},
        {header: 'Cost', width: 13},
        {header: 'Fee', width: 13},
    ]

    const rows = trades.map(trade => [trade.datetime.toLocaleString(), trade.side, trade.symbol, trade.price, trade.amount, trade.cost, trade.fee.cost]);
    sheet.addRows(rows);
    centerAllLines(sheet);
};

const addTradesPerCurrency = (workbook, tradeMap) => {
    for (const [currency, trades] of Object.entries(tradeMap)) {
        addTradesToSheet(workbook, trades, currency);
    }
};

(async () => {
    const myTrades = await getAllTrades();
    myTrades.sort((a, b) => a.timestamp - b.timestamp);
    const tradeMap = buildTradeMap(myTrades);
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    addTradesToSheet(workbook, myTrades, 'total');
    addTradesPerCurrency(workbook, tradeMap);
    await workbook.xlsx.writeFile("trades.xlsx");
})()
