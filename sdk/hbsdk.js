var config = require('config');
var CryptoJS = require('crypto-js');
var Promise = require('bluebird');
var moment = require('moment');
var HmacSHA256 = require('crypto-js/hmac-sha256')
var http = require('../framework/httpClient');
var url = require('url');

const URL = 'https://api.huobipro.com';

const HOST = url.parse(URL).host;
// const HOST = 'api.huobi.pro'; //备用地址

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36"
}

function get_auth() {
    var sign = config.huobi.trade_password + 'hello, moto';
    var md5 = CryptoJS.MD5(sign).toString().toLowerCase();
    let ret = encodeURIComponent(JSON.stringify({
        assetPwd: md5
    }));
    return ret;
}

function sign_sha(method, baseurl, path, data) {
    var pars = [];
    for (let item in data) {
        pars.push(item + "=" + encodeURIComponent(data[item]));
    }
    var p = pars.sort().join("&");
    var meta = [method, baseurl, path, p].join('\n');
    // console.log(meta);
    var hash = HmacSHA256(meta, config.huobi.secretkey);
    var Signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(hash));
    // console.log(`Signature: ${Signature}`);
    p += `&Signature=${Signature}`;
    // console.log(p);
    return p;
}

function get_body() {
    return {
        AccessKeyId: config.huobi.access_key,
        SignatureMethod: "HmacSHA256",
        SignatureVersion: 2,
        Timestamp: moment.utc().format('YYYY-MM-DDTHH:mm:ss'),
    };
}

function call_api(method, path, payload, body) {
    return new Promise(resolve => {
        var account_id = config.huobi.account_id_pro;
        var url = `${URL}${path}?${payload}`;

//*********log url*********
//        console.log(url);   
        var headers = DEFAULT_HEADERS;
        headers.AuthData = get_auth();

        if (method == 'GET') {
            http.get(url, {
                timeout: 1000,
                headers: headers
            }).then(data => {
                let json = JSON.parse(data);
                if (json.status == 'ok') {
                    //console.log(json.data);
                    resolve(json.data);
                } else {
                    console.log('调用错误', json);
                    resolve(null);
                }
            }).catch(ex => {
                console.log(method, path, '异常', ex);
                resolve(null);
            });
        } else if (method == 'POST') {
            http.post(url, body, {
                timeout: 1000,
                headers: headers
            }).then(data => {
                let json = JSON.parse(data);
                if (json.status == 'ok') {
                    //console.log(json.data);
                    resolve(json.data);
                } else {
                    console.log('调用错误', json);
                    resolve(null);
                }
            }).catch(ex => {
                console.log(method, path, '异常', ex);
                resolve(null);
            });
        }
    });
}

var HUOBI_PRO = {

    get_kline: function(symbol,period,size){
	var path = `/market/history/kline`;
        return call_api('GET', path, 'symbol='+symbol+'&period='+period+'&size='+size, '');
    },
    get_account: function() {
        var path = `/v1/account/accounts`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    get_balance: function(accountType) {
	var account_id = '';
	switch(accountType){
	    case 'spot': account_id = config.huobi.account_id_spot; break;
	    case 'margin': account_id = config.huobi.account_id_margin; break;
	    case 'otc': account_id = config.huobi.account_id_otc; break;
	    case 'super-margin': account_id = config.huobi.account_id_supermargin; break;
	}
        
        var path = `/v1/account/accounts/${account_id}/balance`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);

        return call_api('GET', path, payload, body);
    },
    get_open_orders: function(symbol) {
        var path = `/v1/order/orders`;
        var body = get_body();
        body.symbol = symbol;
        body.states = 'submitted,partial-filled';
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    get_order: function(order_id) {
        var path = `/v1/order/orders/${order_id}`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    search_order: function(accountType, symbol, state, type){
	var path = `/v1/order/orders`;
        var body = get_body();
	switch(accountType){
            case 'spot': body["account-id"] = config.huobi.account_id_spot; break;
            case 'margin': body["account-id"] = config.huobi.account_id_margin; break;
            case 'super-margin': body["account-id"] = config.huobi.account_id_supermargin; break;
            default: break;
        }

	body.symbol = symbol;
	body.states = state;
	body.types = type;
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);	
    },
    order_detail: function(order_id){
    	var path = `/v1/order/orders/${order_id}/matchresults`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    buy_limit: function(accountType, symbol, amount, price) {
        var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

	switch(accountType){
	    case 'spot': body["account-id"] = config.huobi.account_id_spot; break;
	    case 'margin': body["account-id"] = config.huobi.account_id_margin; break;
	    case 'super-margin': body["account-id"] = config.huobi.account_id_supermargin; break;
	    default: break;
	}
        body.type = "buy-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;

        return call_api('POST', path, payload, body);
    },

    buy_market: function(accountType, symbol, amount){
	var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        switch(accountType){
            case 'spot': body["account-id"] = config.huobi.account_id_spot; break;
            case 'margin': body["account-id"] = config.huobi.account_id_margin; break;
            case 'super-margin': body["account-id"] = config.huobi.account_id_supermargin; break;
            default: break;
        }
        body.type = "buy-market";
        body.amount = amount;
        body.symbol = symbol;

	switch(accountType){
	    case 'spot': body.source = "spot-api"; break;
	    case 'margin': body.source = "margin-api"; break;
	    case 'super-margin': body.source = "super-margin-api"; break;
	}

	console.log(body);

	return call_api('POST', path, payload, body);
    },

　　sell_market: function(accountType, symbol, amount){
        var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        switch(accountType){
            case 'spot': body["account-id"] = config.huobi.account_id_spot; break;
            case 'margin': body["account-id"] = config.huobi.account_id_margin; break;
            case 'super-margin': body["account-id"] = config.huobi.account_id_supermargin; break;
            default: break;
        }
        body.type = "sell-market";
        body.amount = amount;
        body.symbol = symbol;

	switch(accountType){
            case 'spot': body.source = "spot-api"; break;
            case 'margin': body.source = "margin-api"; break;
            case 'super-margin': body.source = "super-margin-api"; break;
        }

        return call_api('POST', path, payload, body);
    },

    //type: in(from spot to super-margin) or out(from super-margin to spot)
    supermargin_transfer: function(currency, amount, type){
	var path = '';
	if(type=='in'){
	    path = '/v1/cross-margin/transfer-in';
	}
	else{
	    path = '/v1/cross-margin/transfer-out';
	}
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body["account-id"] = config.huobi.account_id_pro;
        body.amount = amount;
        body.currency = currency;
        return call_api('POST', path, payload, body);
    },

    supermargin_loan_info: function(){
	var path = '/v1/cross-margin/loan-info';
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },

    supermargin_loan_orders: function(loanState){
	var path = '/v1/cross-margin/loan-orders';
        var body = get_body();
	if(loanState!=''){
	    body.state = loanState;
	}
	
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);	
    },

    supermargin_loan: function(currency, amount){
	var path = '/v1/cross-margin/orders';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body.currency = currency;
        body.amount = amount;

        return call_api('POST', path, payload, body);	
    },

    supermargin_repay: function(orderId, amount){
        var path = '/v1/cross-margin/orders/'+orderId+'/repay';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

	body.amount = amount;

        return call_api('POST', path, payload, body);
    },
	
    sell_limit: function(symbol, amount, price) {
        var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

	switch(accountType){
            case 'spot': body["account-id"] = config.huobi.account_id_spot; break;
            case 'margin': body["account-id"] = config.huobi.account_id_margin; break;
            case 'super-margin': body["account-id"] = config.huobi.account_id_supermargin; break;
            default: break;
        }

        body.type = "sell-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;

        return call_api('POST', path, payload, body);
    },
    withdrawal: function(address, coin, amount, payment_id) {
        var path = `/v1/dw/withdraw/api/create`;
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body.address = address;
        body.amount = amount;
        body.currency = coin;
        if (coin.toLowerCase() == 'xrp') {
            if (payment_id) {
                body['addr-tag'] = payment_id;
            } else {
                console.log('huobi withdrawal', coin, 'no payment id provided, cancel withdrawal');
                return Promise.resolve(null);
            }
        }

        return call_api('POST', path, payload, body);
    }
}

module.exports = HUOBI_PRO;
