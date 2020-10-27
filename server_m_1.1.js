var http = require('http');
const user0 = require('./sdk/hbsdk');
//const user1 = require('./sdk/hbsdk1');
var events = require('events');

var eventEmitter = new events.EventEmitter();

eventEmitter.on('loanSignal', function(){
        console.log('loan start!');
        loan();
});

eventEmitter.on('buySignal', function(){
        console.log('buy start!');
        buyMarket();
});

eventEmitter.on('repaySignal', function(){
        console.log('repay start!');
        repay();
});

eventEmitter.on('sellSignal', function(){
        console.log('sell start!');
        sellMarket();
});


var mesStr = '';
var rsiStr = '';

var strKL = '';

function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

function timeConverter1(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour;
  if(a.getHours()+9>24){
	hour = a.getHours()+9-24;
  }
  else{
	hour = a.getHours()+9;
  }
	
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date+' '+month+' '+hour + '/' + min;
  return time;
}


function getAverage(array){

        var sum = 0;
        var n;
    
        for(n in array){

                sum += array[n];

        }   
        return sum/array.length;
}

function getScaledNumber(num, n){
	var s;
	if(num.toString().includes('.')){
		if(num.toString().split('.')[1].length>n){
			s = num.toString().split('.')[0]+'.'+num.toString().split('.')[1].slice(0,n);
		}
		else{
			s = num.toString();
		}
	}
	else{
		s = num.toString();
	}

	return Number(s);
}

function getSNumber(num, n){
	var s;
        if(num.toString().includes('.')){
		if(num.toString().split('.')[1].length>n){
			if(Number(num.toString().split('.')[1].slice(n+1))>0){
  //              		console.log(Number(num.toString().split('.')[1].slice(n+1))+'   00  ');
				s = num.toString().split('.')[0]+'.'+(Number(num.toString().split('.')[1].slice(0,n))+1).toString();
        		}
			else{
				s = num.toString().split('.')[0]+'.'+num.toString().split('.')[1].slice(0,n);
			}

		}
		else{
			s = num.toString();
		}
	}
        else{
                s = num.toString();
        }

//	console.log('number is '+ s);
        return Number(s);
}


//function to generate ma value from a given JSON data
function maGenerator(n, data){
        var tempArray = new Array(data.length);
        var c;
        for(c in data){
                tempArray[c] = data[c].close;
        }   
    
        var maArray = new Array(tempArray.length-n+1);
        for(tn=0;tn<maArray.length;tn++){
                maArray[tn] = getAverage(tempArray.slice(tn,tn+n));
        }

        return maArray;
}

//function to generate vwap value
function vwapGenerator(n, data){
	var vwap = new Array(data.length-n+1);

	for(var i=0;i<vwap.length;i++){
		var sum = 0;
		var asum = 0;
		for(var j=0;j<n;j++){
			sum += data[i+j].close * data[i+j].amount;
			asum += data[i+j].amount;
		}
		vwap[i] = sum/asum;
	}

	return vwap;
}

//function to generate boll value 
function bollGenerator(data, index){
	
	var k = 2; 

	var md = new Array(data.length-19);
	var ma20 = maGenerator(20, data);
	var close = new Array(data.length);
	for(var i=0;i<md.length;i++){
		var sum = 0;
		for(var j=0;j<20;j++){
			sum += Math.pow(data[i+j].close - ma20[i], 2); 
		}
		md[i] = Math.sqrt(sum/20);
		
	}	

	var MB = ma20[index];
	var UP = MB + k*md[index];
	var DN = MB - k*md[index];

	return [MB, UP, DN];
}


function emaGenerator(n, data){
	var ema = new Array(data.length);
	ema[ema.length-1] = data[data.length-1].close;
	for(var i=1;i<ema.length;i++){
		ema[ema.length-1-i] = ema[ema.length-i]*(n-1)/(n+1)+data[ema.length-1-i].close*2/(n+1);
	}
	return ema;
}

function diffGenerator(data){
	var diff = new Array(data.length);
	var ema12 = emaGenerator(12, data);
	var ema26 = emaGenerator(26, data);

	for(var i=0;i<data.length;i++){
		diff[i] = ema12[i] - ema26[i];
	}

	return diff;
}


function deaGenerator(data){
	var dea = new Array(data.length);
	var diff = diffGenerator(data);

	dea[data.length-1] = diff[data.length-1];
	for(var i=1;i<dea.length;i++){
		dea[data.length-1-i] = dea[data.length-i]*0.8 + diff[data.length-1-i]*0.2;
	}

	return dea;
}


function barGenerator(data){
	var bar = new Array(data.length);
	var diff = diffGenerator(data);
	var dea = deaGenerator(data);

	for(var i=0;i<bar.length;i++){
		bar[i] = diff[i]-dea[i];
	}

	return bar;
}


function getDiffArr(dataArr){
	var arr = new Array(dataArr.length-1);
	for(var i=0;i<arr.length;i++){
		if(dataArr[i]-dataArr[i+1]>=0){
			arr[i] = 'up';
		}
		else{
			arr[i] = 'down';
		}
	}

	return arr;
}


function getLoanableAmount(data, currency){
	var loanableAmount;
	for(var i=0;i<data.length;i++){
		if(data[i].currency==currency){
			loanableAmount = data[i]['loanable-amt'];
		}
	}
	return loanableAmount;
}

function loan(){
	user0.supermargin_loan_info().then((res) =>{
        	var loanAmount = Number(getLoanableAmount(res, 'usdt'));

		if(loanAmount>1){
		user0.supermargin_loan('usdt', getScaledNumber(loanAmount, 3)).then((res1)=>{
                        console.log('loanID: '+res1);
                        user0.supermargin_loan_orders('accrual').then(console.log);

//                        eventEmitter.emit('buySignal');
                }); 
		}
		else if(loanAmount==0){
			
                        user0.supermargin_loan_orders('accrual').then((res)=>{
                                console.log(res);
                                if(res!=''){
                                        var amount = getSNumber(Number(res[0]['loan-balance'])+Number(res[0]['interest-balance']), 8);
                                        console.log(amount);
                                        user0.supermargin_repay(res[0].id, amount).then(console.log);
                                        eventEmitter.emit('loanSignal');
                                }   
                        }); 
                
		}
        });
}



function repay(){
	user0.supermargin_loan_orders('accrual').then((res)=>{
                console.log(res);
                if(res!=''){
                        var amount = getSNumber(Number(res[0]['loan-balance'])+Number(res[0]['interest-balance']), 8);
                        console.log(amount);
                        user0.supermargin_repay(res[0].id, amount).then(console.log);
                }
        });
}

function checkKlineDiff(data){
	if(data.open<=data.close){
		return ['up',(data.close-data.open).toString(), data.open.toString(), data.close.toString()];
	}
	else{
		return ['down',(data.open-data.close).toString(), data.open.toString(), data.close.toString()];
	}
}

function macdStrategy(klineData){
	var dif = diffGenerator(klineData);
	var bar = barGenerator(klineData);

	console.log('current parice: '+klineData[0].close);
	console.log('MACD--diff(last 3): '+dif.slice(0,3).join(' - '));
        console.log('MACD--bar(last 3): '+bar.slice(0,3).join(' - '));

	if(bar[0]>=0&&bar[0]>bar[1]&&bar[1]>bar[2]&&bar[3]<0&&bar[4]<0){
        	if(dif[0]>=0&&dif[0]>dif[1]&&dif[1]>dif[2]){
                	return 'buy';
                }
                else{
                        return 'hold';
                }
        }
	else if(bar[0]<bar[1]&&bar[1]<bar[2]){
                return 'sell';
        }
        else{
                return 'hold';
        }
}

function max(x, y){
	if(x>=y){
		return x;
	}
	else{
		return y;
	}
	
}

function rsiGenerator(n, klineData){
	var rsi = new Array(klineData.length-n+1);
	var sma1 = new Array(klineData.length-n+1);
	var sma2 = new Array(klineData.length-n+1);
	
	sma1[klineData.length-n] = max(klineData[klineData.length-n].close-klineData[klineData.length-n+1].close, 0);
	sma2[klineData.length-n] = Math.abs(klineData[klineData.length-n].close-klineData[klineData.length-n+1].close); 

	rsi[klineData.length-n] = sma1[klineData.length-n]/sma2[klineData.length-n] * 100;


	for(var i=klineData.length-n-1;i>=0;i--){
		sma1[i] = (max(klineData[i].close-klineData[i+1].close, 0) + (n-1)*sma1[i+1])/n;
		sma2[i] = (Math.abs(klineData[i].close-klineData[i+1].close) + (n-1)*sma2[i+1])/n;
		rsi[i] = sma1[i]/sma2[i]*100
	}	
	
	return rsi;

}

function bollStrategy(klineData){

	
/*
	var diffArr = getDiffArr(maGenerator(5,klineData)); //ma5
	var diffArr1 = getDiffArr(maGenerator(10,klineData)); //ma10
	var diffArr2 = getDiffArr(maGenerator(30,klineData)); //ma30
	console.log('ma5(last 7): '+diffArr.slice(0,7));
	console.log('ma10(last 7): '+diffArr1.slice(0,7));
	console.log('ma30(last 7): '+diffArr2.slice(0,7));
	kcData = checkKlineDiff(klineData[1]);
	console.log('last kline: '+kcData+'----'+klineData[1].vol);
	console.log('current kline: ('+timeConverter(klineData[0].id)+')  '+checkKlineDiff(klineData[0]));
	ma5 = maGenerator(5,klineData);
	
*/
	console.log('current parice: '+klineData[0].close);
	console.log('current boll upline: '+ bollGenerator(klineData, 0)[1]);
	console.log('current boll downline: '+ bollGenerator(klineData, 0)[2]);
	console.log('----------------------------\nlast kline: open-'+klineData[1].open+'|  close-'+klineData[1].close);
	console.log('last boll upline: '+ bollGenerator(klineData, 1)[1]);
        console.log('last boll downline: '+ bollGenerator(klineData, 1)[2]);

	if(klineData[0].close<bollGenerator(klineData, 0)[2]&&klineData[0].close>klineData[0].open){
		if(klineData[1].close<bollGenerator(klineData, 1)[2]&&klineData[1].close<klineData[1].open){
			return 'buy';
		}
		else{
			return 'hold';
		}
	}
	else if(klineData[0].close>bollGenerator(klineData, 0)[1]&&klineData[0].close<klineData[0].open){
		if(klineData[1].close>klineData[1].open&&klineData[1].close>bollGenerator(klineData, 1)[1]){
			return 'sell';
		}
		else{
			return 'hold';
		}
	}
	else{

		return 'hold';
	}






/*

        if(diffArr[0]=='up'&&diffArr[1]=='down'&&kcData[0]=='up'){
                if(diffArr1[0]=='down'&&diffArr2[0]=='down'){
                        return 'hold';
                }   
                else{
                        return 'buy';
                }   
    
        }   
        else if(diffArr[0]=='up'&&diffArr[1]=='down'&&diffArr1[0]=='up'&&diffArr2[0]=='up'){
                return 'buy';
        }   
        else if(diffArr[0]=='down'&&diffArr[1]=='up'){

                if(kcData[0]=='up'&&Number(kcData[2])>ma5[1]){
                        return 'hold';
                }   
                else{
                        return 'sell';
                }   
        }   
        else{
                return 'hold';
        }   

*/

}
var mes1 = '';
function difMes(a, b){
	if(a>=b){
		return '+'+getScaledNumber((a-b), 3);
	}
	else{
		return '-'+getScaledNumber((b-a), 3);
	}
}

function rsiStrategy(data){
	rsi = rsiGenerator(14, data);
	var limt = 25;
	
	rsiStr = 'current rsi(当前rsi): '+getScaledNumber(rsi[0], 3)+' ('+difMes(rsi[0],rsi[1])+')\n'+'history rsi(历史rsi): '+ getScaledNumber(rsi[1], 3)+' ('+difMes(rsi[1],rsi[2])+')--'+getScaledNumber(rsi[2], 3)+' ('+difMes(rsi[2],rsi[3])+')--'+getScaledNumber(rsi[3], 3)+' ('+difMes(rsi[3],rsi[4])+')';
//	console.log('current rsi(当前rsi): '+getScaledNumber(rsi[0], 3)+' ('+difMes(rsi[0],rsi[1])+')');
//	console.log('history rsi(历史rsi): '+ getScaledNumber(rsi[1], 3)+' ('+difMes(rsi[1],rsi[2])+')--'+getScaledNumber(rsi[2], 3)+' ('+difMes(rsi[2],rsi[3])+')--'+getScaledNumber(rsi[3], 3)+' ('+difMes(rsi[3],rsi[4])+')');

	var valleyStr = '';

	for(var i=1;i<rsi.length-1;i++){
		if(rsi[i]<rsi[i-1]&&rsi[i]<rsi[i+1]){
			valleyArr += ','+i.toString();
		}
	}

	var valleyArr = valleyArr.split(',').slice(1, valleyArr.split(',').length);

	//console.log('****'+rsi[Number(valleyArr[0])]);
	var macd = barGenerator(data);

	if(rsi[1]>limt){
		if(rsi[1]<50&&rsi[0]>rsi[1]+12&&rsi[1]<rsi[2]){
			return 'buy';
		}
		else{
			return 'hold';
		}
	}
	else{

		if(rsi[1]<rsi[2]&&rsi[2]<rsi[3]){
                	if(rsi[0]>rsi[1]){
                        	return 'buy';
                	}   
                	else{
                        	return 'hold';
                	}   
        	}   

        	else if(rsi[0]<rsi[Number(valleyArr[0])]){
                	return 'sell';
        	}   

        	else{
                	return 'hold';
        	}	

	}

}

var rsiLimt = 80;
var rsiLimtRate = 0.0002;
var rsiLimt2 = 17;
var straType = 'V';

function rsiStrategy1(data){
	var rsi = rsiGenerator(14, data);
        //var limt = 50;

	var ma5 = maGenerator(5, data);

        var valleyStr = '';

        for(var i=1;i<rsi.length-1;i++){
                if(rsi[i]<rsi[i-1]&&rsi[i]<rsi[i+1]){
                        valleyArr += ','+i.toString();
                }
        }

	var valleyArr = valleyArr.split(',').slice(1, valleyArr.split(',').length);

        //console.log('****'+rsi[Number(valleyArr[0])]);
        var macd = barGenerator(data);
	if(rsi[1]<rsiLimt){
		if(rsi[1]>=rsiLimt2){

			if(straType == 'V'){
				//if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&rsi[3]>rsi[2]&&(data[1].high-data[1].open)/data[1].open<rsiLimtRate){
                                if(data[0].close>data[1].close&&data[1].close<data[1].open&&data[2].close<data[2].open&&(data[1].high-data[1].open)/data[1].open<rsiLimtRate){	
					return 'buy';
                        	}
/*				else if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&rsi[3]>rsi[2]&&(data[1].high-data[1].open)/data[1].open<rsiLimtRate){
					return 'buy';
				}
*/				else if(data[0].close>data[1].close&&data[1].close<data[1].open&&data[2].close<data[2].open&&(data[1].close-data[1].low)/data[1].open<rsiLimtRate){
					return 'buy';
				}
/*				else if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&rsi[3]>rsi[2]&&(data[1].close-data[1].low)/data[1].open<rsiLimtRate){
					return 'buy';
				}
  */                      	else{
                                	return 'hold';
                        	}

			}
			else if(straType == 'N'){
				if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&rsi[3]<rsi[2]&&(data[1].high-data[1].open)/data[1].open<rsiLimtRate){
                                        return 'buy';
                                }
                                else{
                                        return 'hold';
                                }
			}
			else{
				if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&(data[1].high-data[1].open)/data[1].open<rsiLimtRate){
                                        return 'buy';
                                }
                                else{
                                        return 'hold';
                                }	
			}

		}
		else{
			if(rsi[0]>rsi[1]&&rsi[2]>rsi[1]&&rsi[3]>rsi[2]){
				return 'buy';
			}
			else{
				return 'hold';
			}
		}
		
	}
	else{
		return 'hold';
	}

/*

        if(rsi[1]>limt){
                if(rsi[1]<50&&rsi[0]>rsi[1]+12&&rsi[1]<rsi[2]){
                        return 'buy';
                }
                else{
                        return 'hold';
                }
        }
        else{

                if(rsi[1]<rsi[2]&&rsi[2]<rsi[3]){
                        if(rsi[0]>rsi[1]){
                                return 'buy';
                        }
                        else{
                                return 'hold';
                        }
                }

                else if(rsi[0]<rsi[Number(valleyArr[0])]){
                        return 'sell';
                }

                else{
                        return 'hold';
                }

        }
*/


}



function signalFilter(signal, target){
	if(signal==target){
		return 'hold';
	}
	else{
		return signal;
	}
}

function priceCompare(price1, price2, amount){
	mes1 = 'bought_amount:'+getScaledNumber(amount, 4)+' usdt,';
	//console.log('Bought amount(买入数量): '+getScaledNumber(amount, 4)+' usdt');
	if(price1>=price2){
		return 'profit:'+getScaledNumber((price1-price2),3)+',percentage: +'+ getScaledNumber((price1-price2)/price2*100, 4)+'%,actual_profit: '+getScaledNumber(amount*(price1-price2)/price2,3)+' usdt,';
	}
	else if(price2>price1){
		return 'loss: '+getScaledNumber((price2-price1),3)+',percentage: -'+ getScaledNumber((price2-price1)/price2*100, 4)+'%,actual_loss: '+getScaledNumber(amount*(price2-price1)/price2,3)+' usdt,';
	}
	
}


var winRate = 1.0513;
var loseRate = 0.916;

function getScaledArr(arr, n){
	var rArr = new Array(arr.length);
	for(var i=0;i<arr.length;i++){
		rArr[i] = getScaledNumber(arr[i], n);
	}

	return rArr;
}

var period = 'wfb';
var mesToSend ='';
var sellMes = '';
var buyMes = '';
var stateMes = '';
var balanceMes = '';

var online = true;

var oldBalance = 900;
var oldBalance1 = 967.7333045+237.6195;

var latestOrder = '';
var periodType = '4hour';

var targetCurrency = 'ocn';
var tradeCurrency = 'usdt';
var symbol = targetCurrency+tradeCurrency;

var noHis = false;

var catalog = ['empty'];

function setCatalog(currency, boughtAmount, profit){
	if(catalog[0] == 'empty'){
		catalog[0] = currency + '|' + boughtAmount + '|' + profit;
	}
	else{
		var isCheck = false;
		for(var i=0;i<catalog.length;i++){
			if(currency==catalog[i].split('|')[0]){
				if(boughtAmount!=catalog[i].split('|')[1]||profit!=catalog[i].split('|')[2]){
					catalog[i] = currency + '|' + boughtAmount + '|' + profit;
				}
				isCheck = true;
			}

			if(i==catalog.length-1&&!isCheck){
				catalog.push(currency + '|' + boughtAmount + '|' + profit)
			}
			
		}
	}
}

function checkCatalogCurrency(currency){

	var isCheck = false;
        for(var i=0;i<catalog.length;i++){
                if(catalog[i].split('|')[0]==currency){
                        isCheck = true;
                }


        }

        if(isCheck){
                return 'found';
        }
        else{
                return 'noResult';
        }

}

function checkCatalog(currency){
	var isCheck = false;
	for(var i=0;i<catalog.length;i++){
		if(catalog[i].split('|')[0]==currency&&catalog[i].split('|')[1]!='null'){
			isCheck = true;
		}
		
		
	}

	if(isCheck){
		return 'bought';
	}
	else{
		return 'sold';
	}
}

var partAmount = 152;
var threshold = 250;
var num = 15;

var isBoughtRequest = false;
function executeman(marketData){
	var res = marketData;

	//getLatestOrder('spot', symbol, 'filled', '');

	//console.log(period);
        var signal;

	
	if(latestOrder.type=='buy-limit'||latestOrder.type=='buy-market'){
		setCatalog(latestOrder.symbol, getScaledNumber(latestOrder.amount, 4), '0');
	}
	else if(latestOrder.type=='sell-limit'||latestOrder.type=='sell-market'){
		setCatalog(latestOrder.symbol, 'null', '0');
	}

        var tempLog = 'period:'+period+',';
	tempLog += 'currencies:';
	for(var i=0;i<currencyArray.length;i++){
		tempLog += currencyArray[i].split(',')[0];
		if(i<currencyArray.length-1){
			tempLog += '&';
		}
	}
	tempLog += ',';

	tempLog += 'catalog:'
	for(var i=0;i<catalog.length;i++){
		if(i<catalog.length-1){

			tempLog += catalog[i]+'&';
		}
		else{
			tempLog += catalog[i];
		}
	}
	tempLog += ',';


	tempLog += 'part_amount:'+partAmount+',';
	tempLog += 'oldBalance1:'+oldBalance1+',';
	tempLog += 'threshold:'+threshold+',';
	tempLog += 'target_currency:'+targetCurrency+',';
	tempLog += 'trade_currency:'+tradeCurrency+',';
	if(online){
        	tempLog += 'online:on,';
        }
        else{
                tempLog += 'online:off,';
        }

	tempLog += 'period_type:'+periodType+',';
        tempLog += 'kdata:';   /*+toNonExponential(res[0].close)+'-'+getScaledNumber(res[0].amount, 2)+'-';
        tempLog += toNonExponential(res[0].open)+'-'+timeConverter1(res[0].id)+',';
        tempLog += 'past_period:'+toNonExponential(res[1].close)+'-'+getScaledNumber(res[1].amount, 2)+'-'+toNonExponential(res[1].open)+'-'+timeConverter1(res[1].id)+'|';
        tempLog += toNonExponential(res[2].close)+'-'+getScaledNumber(res[2].amount, 2)+'-'+toNonExponential(res[2].open)+'-'+timeConverter1(res[2].id)+'|';
        tempLog += toNonExponential(res[3].close)+'-'+getScaledNumber(res[3].amount, 2)+'-'+toNonExponential(res[3].open)+'-'+timeConverter1(res[3].id)+',';
*/

	
	for(var i=0;i<num;i++){
		tempLog += i==num-1 ? toNonExponential(res[i].open)+'-'+toNonExponential(res[i].close)+'-'+toNonExponential(res[i].low)+'-'+toNonExponential(res[i].high)+'-'+getScaledNumber(res[i].amount, 2)+'-'+timeConverter1(res[i].id)+',' : toNonExponential(res[i].open)+'-'+toNonExponential(res[i].close)+'-'+toNonExponential(res[i].low)+'-'+toNonExponential(res[i].high)+'-'+getScaledNumber(res[i].amount, 2)+'-'+timeConverter1(res[i].id)+'|';
	}


	//tempLog += 'ma5:'+getScaledArr(maGenerator(5, res), 2).slice(0,6).join('&')+',';
        tempLog += 'rsi:'+getScaledArr(rsiGenerator(14, res), 2).slice(0,6).join('&')+',';
        tempLog += 'set_win_rate:'+winRate+',';
	tempLog += 'set_lose_rate:'+loseRate+',';
	tempLog += 'rsi_limt:'+rsiLimt+',';
	tempLog += 'rsi_limt2:'+rsiLimt2+',';
	tempLog += 'rsi_limt_rate:'+rsiLimtRate+','
	tempLog += 'stra_type:'+straType+','

                        /*user0.search_order('super-margin', 'btcusdt', 'filled', '').then((orderRes)=>{
                          
				var latest = 0;
                                var index;
                                for(var i=0;i<orderRes.length;i++){
                                        if(orderRes[i]['finished-at']>latest){
                                                latest = orderRes[i]['finished-at'];
                                                index = i;
                                        }
                                }
*/
	if(latestOrder['finished-at']>res[0].id*1000){
		console.log((latestOrder['finished-at']-(res[0].id*1000))/1000/3600);
	}
	else{
		console.log((latestOrder['finished-at']-(res[0].id*1000))/1000/3600);
	}
	console.log('last:'+latestOrder['finished-at']);

	if(latestOrder!=''){
	user0.order_detail(latestOrder.id).then((detailRes)=>{
                                        if(detailRes[0].symbol==symbol){
					if(detailRes[0].type=='buy-market'||detailRes[0].type=='buy-limit'){
                                                //console.log('wait for sell');
                                                stateMes = 'state:wait_for_sell,';
                                                if(res[0].close>detailRes[0].price){
                                                        buyMes = 'profit:'+getScaledNumber((res[0].close-detailRes[0].price), 2)+',';
                                                        buyMes += 'actual_profit:'+getScaledNumber(res[0].close/detailRes[0].price*latestOrder.amount-latestOrder.amount, 2)+' '+tradeCurrency+',';
                                                }
                                                else{
                                                        buyMes = 'loss:'+getScaledNumber((detailRes[0].price-res[0].close), 2)+',';
                                                        buyMes += 'actual_loss:'+getScaledNumber(res[0].close/detailRes[0].price*latestOrder.amount-latestOrder.amount, 2)+' '+tradeCurrency+',';
                                                }
                                                buyMes += 'percentage:'+getScaledNumber((res[0].close-detailRes[0].price)/detailRes[0].price*100, 2)+'%,'
                                                setCatalog(detailRes[0].symbol, getScaledNumber(latestOrder.amount, 4), getScaledNumber((res[0].close-detailRes[0].price)/detailRes[0].price*100, 2)+'%');
						buyMes += 'bought_in_price:'+detailRes[0].price+',bought_amount:'+getScaledNumber(latestOrder.amount, 4)+' '+tradeCurrency+',';
                                                //sellLimit();
                                                period = 'bought';
                                                user0.get_open_orders('spot',symbol,'sell').then((gooRes) =>{
                                                        if(gooRes.length==0){
                                                                //console.log('sell limit order sold');
                                                        	if(res[0].close>detailRes[0].price*loseRate){
									sellLimit(winRate);
								}
								else{
									sellMarket();
									//sellLimit(getScaledNumber(res[0].close*0.9995/detailRes[0].price, 4));
								}
								
							}
                                                        else{

								//console.log('*********'+getScaledNumber(res[0].close/detailRes[0].price, 4));
								if(res[0].close<detailRes[0].price*loseRate&&gooRes[0].price>detailRes[0].price){
									user0.cancel_open_orders('spot', symbol, 'sell');
								}
                                                                //console.log('limit sell order waiting, limit price is '+gooRes[0].price);
                                                                sellMes = 'expected_sell_price:'+toNonExponential(getScaledNumber(gooRes[0].price, 10))+',';
								sellMes += 'stop_lose_price:'+toNonExponential(getScaledNumber(detailRes[0].price*loseRate))+',';
                                                        
							}

                                                });
                                        }


					else if(detailRes[0].type=='sell-market'||detailRes[0].type=='sell-limit'){
						stateMes = 'state:wait_for_buy,';
                                                if(detailRes[0].type=='sell-market'){
                                                        stateMes = 'last_profit:-,';
                                                }
                                                else if(detailRes[0].type=='sell-limit'){
                                                        stateMes = 'last_profit:+,';
                                                }
						user0.get_balance('spot').then((res) =>{
                                                        //console.log(res.type);
                                                        var tBalance = 0;
                                                        for(var i=0;i<res.list.length;i++){
                                                                if(res.list[i].currency==tradeCurrency){
                                                                        //console.log(res.list[i]);
                                                                        if(res.list[i].type=='trade'){
                                                                                balanceMes ='current_usdt_balance:'+getScaledNumber(Number(res.list[i].balance), 8)+',';
                                                                                balanceMes +='balance_profit:'+getScaledNumber(res.list[i].balance - oldBalance, 8)+' '+tradeCurrency+',';
                                                                                balanceMes +='profit_rate:'+getScaledNumber((Number(res.list[i].balance)-oldBalance)/oldBalance*100, 2)+'%,'
                                                                        }
                                                                }

                                                        }

                                                });

						switch(period){
                                                        case 'bought':
                                                                //repay();

                                                                //user0.supermargin_loan_orders('accrual').then((loanRes)=>{

                                                                //        if(loanRes.length==0){
                                                                                period = 'wfb';
                                                                //        }
                                                                //});
                                                                break;
                                                        case 'wfb':
                                                                signal = signalFilter(rsiStrategy1(res), 'sell');
                                                                if(signal=='buy'){
                                                                //console.log('current price: '+res[0].close);
                                                                //if(res[0].close<8828){
                                                                //        loan();
									if(latestOrder['finished-at']>res[0].id*1000&&online&&checkCatalog(symbol)=='sold'&&!isBoughtRequest){
										buyMarket();
                                                                        	period = 'bought';
										isBoughtRequest = true;
										setCatalog(symbol,'0','0');
										getLatestOrder('spot', symbol, 'filled', '');
                                                                	}
								}
                                                                else{
                                                                        
									if(checkCatalogCurrency(symbol)=='found'){
										setCatalog(symbol,'null','0');
									}
									console.log('wait for buy');


                                                                }

                                                                break;
                                                 
                                                }

                                        }
	/*				else if(lastestOrder==''){
						console.log('empty history');
						switch(period){
                                                        case 'bought':
                                                                //repay();

                                                                //user0.supermargin_loan_orders('accrual').then((loanRes)=>{

                                                                //        if(loanRes.length==0){
                                                                                period = 'wfb';
                                                                //        }
                                                                //});
                                                                break;
                                                        case 'wfb':
                                                                signal = signalFilter(rsiStrategy1(res), 'sell');
                                                                if(signal=='buy'){
                                                                //console.log('current price: '+res[0].close);
                                                                //if(res[0].close<8828){
                                                                //        loan();
                                                                        if(online){
                                                                                buyMarket();
                                                                                period = 'bought';
                                                                        }
                                                                }
                                                                else{
                                                                        console.log('wait for buy');

                                                                }

                                                                break;

                                                }
				}
	*/		} 
		});

	}

	else if(noHis&&latestOrder==''){
        	console.log('empty history');
                switch(period){
                	case 'bought':
                                period = 'wfb';
                        	break;
                        case 'wfb':
                                signal = signalFilter(rsiStrategy1(res), 'sell');
                                if(signal=='buy'){
                                	if(online&&checkCatalog(symbol)=='sold'&&!isBoughtRequest){
                                        	buyMarket();
                                                period = 'bought';
						isBoughtRequest = true;
						setCatalog(symbol,'0','0');
						getLatestOrder('spot', symbol, 'filled', '');
                                                }
                                }
                                else{
					if(checkCatalogCurrency(symbol)=='found'){
                                        	setCatalog(symbol,'null','0');
                                        }
                                       	console.log('wait for buy');

                                }

                                break;

                }
        } 

                        mesToSend = tempLog;
               



}


var amountScale = 4;
var priceScale = 8;
var periodCount = 0;

//格式：币种，数量精确位，价格精确位
var currencyArray = ['ada,4,6,0.00004,50,1.0513,0.912',
'trx,2,6,0.00004,80,1.0423,0.935',
'yfii,4,4,0.0004,80,1.0423,0.945',
'nkn,2,6,0.00004,50,1.0612,0.935',
'iost,4,6,0.00004,60,1.0513,0.922',
'ring,2,4,0.00004,80,1.0513,0.935',
'nuls,2,4,0.00004,50,1.0351,0.933',
'bat,2,4,0.00004,60,1.0522,0.931',
'ae,2,4,0.00004,50,1.0504,0.932',
'lxt,2,4,0.00004,60,1.0441,0.935',
'atom,2,4,0.00004,60,1.0423,0.931',
'arpa,2,6,0.00004,80,1.0315,0.931',
'link,2,4,0.00004,60,1.0415,0.929',
'mds,2,6,0.00004,60,1.0504,0.931',
'bsv,4,4,0.00004,60,1.0603,0.925',
'ren,2,6,0.00002,80,1.0612,0.928',
'luna,2,4,0.0004,80,1.117,0.917',
'ruff,4,6,0.00004,80,1.0612,0.925',
'fsn,4,4,0.00002,80,1.0432,0.914',
'aac,2,6,0.00002,80,1.0423,0.936',
'nas,4,4,0.00002,60,1.045,0.925',
'zil,4,6,0.00006,60,1.0441,0.932',
'xmr,4,2,0.00004,60,1.0351,0.927',
'act,2,6,0.00002,60,1.054,0.9128',
'lba,4,6,0.00004,80,1.0432,0.936',
'algo,2,4,0.00004,60,1.0513,0.927',
'xtz,4,4,0.00004,80,1.0333,0.938',
'rvn,2,6,0.00004,60,1.063,0.932',
'qtum,4,4,0.00004,60,1.0423,0.923',
'let,4,6,0.0002,80,1.0712,0.932',
'ocn,4,8,0.0002,80,1.0513,0.926',
'dta,4,8,0.00004,60,1.0342,0.92',
'gxc,4,4,0.00004,60,1.0513,0.926',
'lamb,4,6,0.00004,60,1.0522,0.929'];

function getNextCurrency(cc){
	for(var i=0;i<currencyArray.length;i++){
		if(currencyArray[i].split(',')[0]==cc){
			if(i<currencyArray.length-1){
				return currencyArray[i+1];
			}
			else{
				return currencyArray[0];
			}
		}
		
	}
	
}

function setScales(){
	for(var i=0;i<currencyArray.length;i++){
		if(currencyArray[i].split(',')[0]==targetCurrency){
			amountScale = currencyArray[i].split(',')[1];
			priceScale = currencyArray[i].split(',')[2];
			rsiLimtRate = currencyArray[i].split(',')[3];
			rsiLimt = currencyArray[i].split(',')[4];
			winRate = currencyArray[i].split(',')[5];
			loseRate = currencyArray[i].split(',')[6];
		}

	}
}

var btcRsi = '';
var isLastOrderReady = false;
//扫描kline并买卖
function patrolman(){
	getLatestOrder('spot', symbol, 'filled', '');
	setInterval(function(){
		
		//if(period=='wfb'){
			if(periodCount>3){
				isLastOrderReady = false;
				targetCurrency = getNextCurrency(targetCurrency).split(',')[0];
				symbol = targetCurrency+tradeCurrency;
				setScales();
				isBoughtRequest = false;
				periodCount = 0;
				latestOrder = '';
				getLatestOrder('spot', symbol, 'filled', '');
			}
			else{
			//	if(isLastOrderReady){
					periodCount += 1;
			//	}
			}
		//}
		//else{
		//	periodCount = 0;
		//}

		user0.get_kline(symbol,periodType,'1000').then((res) =>{
			//console.log('now:'+res[0].id);
			executeman(res);

		});

		user0.get_kline('btcusdt',periodType,'1000').then((res) =>{
			var btcRsiSign = rsiGenerator(14, res)[0];
			//console.log(btcRsi);
			if(btcRsiSign>39.7){
				online = true;
			}
			else{
				online = false;
			}
			btcRsi = 'btcRsi:'+btcRsiSign+',';

		});
		
	}
	, 4000);
}


function buyMarket(){
	user0.get_balance('spot').then((res) =>{ 
        //console.log(res.type);
        var tBalance = 0;
        for(var i=0;i<res.list.length;i++){
                if(res.list[i].currency==tradeCurrency){
                        //console.log(res.list[i]);
                        if(res.list[i].type=='trade'){
                                tBalance=Number(res.list[i].balance);
                        }
                }       
                if(res.list[i].currency==targetCurrency){
                        //console.log(res.list[i]);
                }
        }   
	
	if(tBalance<threshold&&tBalance>5){
		user0.get_open_orders('spot',symbol,'sell').then((gooRes) =>{
			if(gooRes.length==0){
				user0.buy_market('spot', symbol, getScaledNumber(tBalance, amountScale));
			}
		});

	}
	else if(tBalance>=threshold){

		user0.get_open_orders('spot',symbol,'sell').then((gooRes) =>{
                        if(gooRes.length==0){
                        	user0.buy_market('spot', symbol, partAmount);
			}
                });	

	
	}

        });
}


function sellLimit(srate){

	user0.get_open_orders('spot',symbol,'sell').then((gooRes) =>{
        	if(gooRes.length==0){
                	user0.get_balance('spot').then((res) =>{
        			//console.log(res.type);
        			var tBalance = 0;
        			for(var i=0;i<res.list.length;i++){
                			if(res.list[i].currency==targetCurrency){
                        			//console.log(res.list[i]);
                        			if(res.list[i].type=='trade'){
                                			tBalance=Number(res.list[i].balance);
                        			}
                			}
                			if(res.list[i].currency==tradeCurrency){
                       	 			//console.log(res.list[i]);
                			}
        			}

        			if(tBalance>0.02){
		/*			user0.search_order('super-margin', 'btcusdt', 'filled', '').then((orderRes)=>{
                                		var latest = 0;
                                		var index;
                                		for(var i=0;i<orderRes.length;i++){
                                        		if(orderRes[i]['finished-at']>latest){
                                                		latest = orderRes[i]['finished-at'];
                                                		index = i;
                                        		}
                                		}
*/                                		user0.order_detail(latestOrder.id).then((detailRes)=>{
                                        		if(detailRes[0].symbol==symbol){
							if(detailRes[0].type=='buy-market'||detailRes[0].type=='buy-limit'){
                                                		
							var sellprice = toNonExponential(getScaledNumber(toNonExponential(detailRes[0].price*srate), priceScale));
							//console.log(sellprice);								
								user0.sell_limit('spot', symbol, getScaledNumber(tBalance, amountScale), sellprice).then((res1)=>{
                                                        		//console.log('sell result--'+res1);

                                                		});
                                        		}
							}

                                		});
                	//		});
        			}
        		});

		}

        });

}

function toNonExponential(num) {
    var m = num.toExponential().match(/\d(?:\.(\d*))?e([+-]\d+)/);
    return num.toFixed(Math.max(0, (m[1] || '').length - m[2]));
}

function sellMarket(){
	user0.get_balance('spot').then((res) =>{ 
        //console.log(res.type);
        var tBalance = 0;
        for(var i=0;i<res.list.length;i++){
                if(res.list[i].currency==targetCurrency){
                        //console.log(res.list[i]);
                        if(res.list[i].type=='trade'){
                                tBalance=Number(res.list[i].balance);
                        }   
                }     
                if(res.list[i].currency==tradeCurrency){
                        //console.log(res.list[i]);
                }   
        }   

	if(tBalance>0.02){
	user0.sell_market('spot', symbol, getScaledNumber(tBalance, amountScale)).then((res1)=>{
                //console.log('sell result--'+res1);

                //eventEmitter.emit('repaySignal');
        }); 
	}

	//eventEmitter.emit('repaySignal');
        });
}


function getLatestOrder(accountType, symbol, state, type){
	noHis = false;
	for(var i=0;i<40;i++){	
		user0.search_order(accountType, symbol, state, type, (new Date().getTime())-86400000*i).then((res)=>{
			if(res!=''&&res!=null){
				
				//console.log(res);
				var latest = 0;
                                var index;
                                for(var j=0;j<res.length;j++){
                                        if(res[j]['finished-at']>latest){
                                                latest = res[j]['finished-at'];
                                                index = j;
                                       	}
					
                                }
				if(latestOrder==''||latestOrder['finished-at'] < res[index]['finished-at']){
					latestOrder = res[index];
					//console.log(lastestOrder);
				}

//				break;

			}
			//console.log('got!!');		

			if(res==''&&latestOrder==''){
				noHis = true;
			}
		});
	}
	if(latestOrder==''){
		console.log('no his');

	}

	
}

function StringToJSON(str){
	jsonStr = '{';

	for(var i=0;i<str.split(',').length;i++){
		jsonStr += i==str.split(',').length-1 ? '' : i==str.split(',').length-2 ? '"'+str.split(',')[i].split(':')[0]+'":"'+str.split(',')[i].split(':')[1]+'"' : '"'+str.split(',')[i].split(':')[0]+'":"'+str.split(',')[i].split(':')[1]+'",';
	}

	jsonStr += '}'
	return JSON.parse(jsonStr);
}

function run() {
    // 准备工作，填写config/default.json中的:
    // access_key & secretkey, www.huobi.com上申请
    // account_id 登陆后看自己的UID
    // trade_password 可以先不填，提现时需要
//user0.search_order('super-margin', 'btcusdt', 'created', '').then(console.log);
    // 第一步，获取account_id
    // user0.get_account().then(console.log);
    // 把get_account获取到的type=spot的id填写到:
    // default.json中的${account_id_pro}中去
//user0.search_order('super-margin', 'btcusdt', 'filled', '').then(console.log);    

	//console.log(symbolJson);
	patrolman();
	//user0.cancel_open_orders('spot', 'dacbtc', 'sell');
	
		const WebSocket = require('ws');


const server = new WebSocket.Server({ port: 9997 });

server.on('open', function open() {
  console.log('connected');
});

server.on('close', function close() {
  //console.log('disconnected');
});

server.on('connection', function connection(ws, req) {
  const ip = req.connection.remoteAddress;
  const port = req.connection.remotePort;
  const clientName = ip + port;

  //console.log('%s is connected', clientName)

	//console.log('win rate set is '+winRate);
  // 发送欢迎信息给客户端

  ws.on('message', function incoming(message) {
   //console.log('received: %s from %s', message, clientName);
	if(message.split(':')[0]=='setWinRate'){
		winRate = getScaledNumber(Number(message.split(':')[1]), 4);
	}
	if(message.split(':')[0]=='setRsiLimt'){
                rsiLimt = Number(message.split(':')[1]);
        	console.log('o----------------'+Number(message.split(':')[1]));
	}
	if(message.split(':')[0]=='setRsiLimtRate'){
        	rsiLimtRate = Number(message.split(':')[1]);
        }
	if(message.split(':')[0]=='periodType'){
		periodType = message.split(':')[1];
	}
	if(message.split(':')[0]=='setRsiLimt2'){
		rsiLimt2 = Number(message.split(':')[1]);
	}
	if(message.split(':')[0]=='setStraType'){
		straType = message.split(':')[1];
	}
	if(message.split(':')[0]=='setLoseRate'){
		loseRate = getScaledNumber(Number(message.split(':')[1]), 4);
	}
	if(message.split(':')[0]=='targetCurrency'){
		targetCurrency = message.split(':')[1];
	}
	if(message.split(':')[0]=='tradeCurrency'){
                tradeCurrency = message.split(':')[1];
        }
	if(message.split(':')[0]=='klineNum'){
		num = message.split(':')[1];
	}
	if(message.split(':')[0]=='online'){
		if(message.split(':')[1]=='on'){
			online = true;
		}
		else if(message.split(':')[1]=='off'){
			online = false;
		}
	}
	if(message.split(':')[0]=='partAmount'){
		partAmount = Number(message.split(':')[1]);
	}
	if(message.split(':')[0]=='threshold'){
		threshold = Number(message.split(':')[1]);
	}
	  //	  winRate = Number(message);

//	  console.log('set win rate: '+ winRate);


    // 广播消息给所有客户端
    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {

          //ws.send(log+mes1+mesStr+rsiStr+'\n--'+log1)
          var str = mesToSend+sellMes+buyMes+btcRsi+balanceMes;
	      client.send(JSON.stringify(StringToJSON(str)));
 
		
		//console.log(StringToJSON(str));

	      //client.send( clientName + " -> " + message);
      }
    });

	  

});	

});

server.on('error', function error(){
                console.log('ws error');
        });












/*
    user0.supermargin_transfer('usdt','100.0','out').then((res1) =>{
	
	console.log('transferId: '+res1);
	user0.get_balance('super-margin').then((res) =>{ 
        console.log(res.type);
        	for(var i=0;i<res.list.length;i++){
                	if(res.list[i].currency=='usdt'){
                        	console.log(res.list[i]);
                	}	   
        	}   

    	});

	user0.get_balance('spot').then((res) =>{ 
        console.log(res.type);
        	for(var i=0;i<res.list.length;i++){
                	if(res.list[i].currency=='usdt'){
                        	console.log(res.list[i]);
                	}   
        	}   

    	});  
 

	user0.supermargin_loan_info().then(console.log);
    });

*/
    


    // 第二步，获取Balance和OpenOrders
    // user0.get_open_orders('btcusdt').then(console.log);

    // 第三步，交易
    // user0.buy_limit('ltcusdt', 0.01, 0.1);

    // 第四步，检查订单
    // user0.get_order(377378515).then(console.log);

    // 第五步，提现
    // 先去网站上设置好安全提现地址
    // 欢迎打赏到我的钱包，我可以协助测试 ^^
    // user0.withdrawal('0x9edfe04c866d636526828e523a60501a37daf8f6', 'etc', 1);
}

run();
