var http = require('http');
const hbsdk = require('./sdk/hbsdk');

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



function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
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
		s = num.toString().split('.')[0]+'.'+num.toString().split('.')[1].slice(0,n);
	}
	else{
		s = num.toString();
	}

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
	hbsdk.supermargin_loan_info().then((res) =>{
        	var loanAmount = Number(getLoanableAmount(res, 'usdt'));

		if(loanAmount>1){
		hbsdk.supermargin_loan('usdt', getScaledNumber(loanAmount, 3)).then((res1)=>{
                        console.log('loanID: '+res1);
                        hbsdk.supermargin_loan_orders('accrual').then(console.log);

                        eventEmitter.emit('buySignal');
                }); 
		}
		else if(loanAmount==0){
			
                        hbsdk.supermargin_loan_orders('accrual').then((res)=>{
                                console.log(res);
                                if(res!=''){
                                        var amount = Number(res[0]['loan-balance'])+Number(res[0]['interest-balance']);
                                        console.log(amount);
                                        hbsdk.supermargin_repay(res[0].id, amount).then(console.log);
                                        eventEmitter.emit('loanSignal');
                                }   
                        }); 
                
		}
        });
}



function repay(){
	hbsdk.supermargin_loan_orders('accrual').then((res)=>{
                console.log(res);
                if(res!=''){
                        var amount = Number(res[0]['loan-balance'])+Number(res[0]['interest-balance']);
                        console.log(amount);
                        hbsdk.supermargin_repay(res[0].id, amount).then(console.log);
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

function difMes(a, b){
	if(a>=b){
		return '+'+getScaledNumber((a-b), 3);
	}
	else{
		return '-'+getScaledNumber((b-a), 3);
	}
}

function rsiStrategy(rsi){
	var limt = 32;


	console.log('current rsi(当前rsi): '+getScaledNumber(rsi[0], 3)+' ('+difMes(rsi[0],rsi[1])+')');
	console.log('history rsi(历史rsi): '+ getScaledNumber(rsi[1], 3)+' ('+difMes(rsi[1],rsi[2])+')--'+getScaledNumber(rsi[2], 3)+' ('+difMes(rsi[2],rsi[3])+')--'+getScaledNumber(rsi[3], 3)+' ('+difMes(rsi[3],rsi[4])+')');

	var valleyStr = '';

	for(var i=1;i<rsi.length-1;i++){
		if(rsi[i]<rsi[i-1]&&rsi[i]<rsi[i+1]){
			valleyArr += ','+i.toString();
		}
	}

	var valleyArr = valleyArr.split(',').slice(1, valleyArr.split(',').length);

	//console.log('****'+rsi[Number(valleyArr[0])]);

	if(rsi[1]>limt){
		if(rsi[1]<70&&rsi[0]>rsi[1]+12&&rsi[1]<rsi[2]){
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

function signalFilter(signal, target){
	if(signal==target){
		return 'hold';
	}
	else{
		return signal;
	}
}

function priceCompare(price1, price2, amount){

	console.log('Bought amount(买入数量): '+getScaledNumber(amount, 4)+' usdt');
	if(price1>=price2){
		return 'profit(预估单位盈利): '+getScaledNumber((price1-price2),3)+'\npercentage(百分比): +'+ getScaledNumber((price1-price2)/price2*100, 4)+'%\nactual profit(预估实际盈利): '+getScaledNumber(amount*(price1-price2)/price2,3)+' usdt';
	}
	else if(price2>price1){
		return 'loss(预估单位损失): '+getScaledNumber((price2-price1),3)+'\npercentage(百分比): -'+ getScaledNumber((price2-price1)/price2*100, 4)+'%\nactual loss(预估实际损失): '+getScaledNumber(amount*(price2-price1)/price2,3)+' usdt';
	}
	
}


var soundOn = true;
var log = '';
var log1 = ' buy/sell history \n';
function scanKline(){
	setInterval(function(){hbsdk.get_kline('btcusdt','15min','200').then((res) =>{
			const sound = require('sound-play');			
			//sound.play('coin.mp3');
			var signal;
			rsi = rsiGenerator(14, res);
			var tempLog = ''	

			var winRate = 1.015;
			var stopLoss = 0.994;
		 //console.log(rsiGenerator(14,res));
			hbsdk.search_order('super-margin', 'btcusdt', 'filled', '').then((orderRes)=>{
                		var latest = 0;
                		var index;
                		for(var i=0;i<orderRes.length;i++){
                        		if(orderRes[i]['finished-at']>latest){
                                		latest = orderRes[i]['finished-at'];
                                		index = i;
                        		}   
                		}   
                		hbsdk.order_detail(orderRes[index].id).then((detailRes)=>{
					if(detailRes[0].type=='buy-market'){
						tempLog += '------------wait for sell------------\ncurrent price(当前价格): '+res[0].close+'\n';
						console.log('------------wait for sell(等待卖出)------------\ncurrent price(当前价格): '+res[0].close);
						tempLog += priceCompare(res[0].close, detailRes[0].price, orderRes[index].amount)+'\n';
						console.log(priceCompare(res[0].close, detailRes[0].price, orderRes[index].amount));
						tempLog += 'Bought-in price: '+detailRes[0].price + '\n';
						console.log('Bought-in price(买入价): '+detailRes[0].price);
						tempLog += 'Expected sell price: '+getScaledNumber(detailRes[0].price*winRate, 3)+'\n';
                                         	console.log('Expected sell price(期望卖出价): '+getScaledNumber(detailRes[0].price*winRate, 3));
						tempLog += 'Stop loss sell price: '+detailRes[0].price*stopLoss+'\n';
						console.log('Stop loss sell price(止损卖出价): '+detailRes[0].price*stopLoss);                                       

						if(res[0].close>detailRes[0].price*winRate||res[0].close<detailRes[0].price*stopLoss){
							signal = 'sell';

							if(soundOn){
								sound.play('coin.mp3');
							}
						}
						else{
							signal = 'hold';
						}
 
                           			
					}

					else if(detailRes[0].type=='sell-market'){
						tempLog += '------------wait for buy-------------\n';
						console.log('------------wait for buy(等待买入)-------------');
						tempLog += 'current price: '+res[0].close+'\n';

						console.log('current price(当前价格): '+res[0].close);		
						signal = signalFilter(rsiStrategy(rsi), 'sell');
						hbsdk.get_balance('super-margin').then((bRes) =>{ 
        						
        						for(var i=0;i<bRes.list.length;i++){
                						if(bRes.list[i].currency=='usdt'){
                        						if(bRes.list[i].type=='trade'){

										tempLog += 'current usdt balance: '+getScaledNumber(bRes.list[i].balance, 4)+'\nprofit: '+getScaledNumber(bRes.list[i].balance-621.525 ,4)+'\nprofit rate: '+getScaledNumber((bRes.list[i].balance-621.525)/621.525*100, 2)+'%\n';
										console.log('current usdt balance(当前usdt余额): '+getScaledNumber(bRes.list[i].balance, 4)+'\nprofit(收益): '+getScaledNumber(bRes.list[i].balance-621.525 ,4)+'\nprofit rate(收益率): '+getScaledNumber((bRes.list[i].balance-621.525)/621.525*100, 2)+'%');


									}
                						}		   
        						} 	
					
						});

						if(signal=='buy'&&soundOn){
							sound.play('coin.mp3');
						}		
                              
					}
					tempLog += '----------------Signal: '+signal+'-----------------\n\n';
					console.log('----------------Signal: '+signal+'-----------------\n\n');

					switch(signal){
                                                 case 'buy': log1+='buy at '+timeConverter(res[0].id)+'\n'; eventEmitter.emit('loanSignal'); break;
                                                 case 'sell': log1+='sell at '+timeConverter(res[0].id)+'\n'; eventEmitter.emit('sellSignal'); break;
                                                 default : break;
                                        }
	                                log = tempLog;
				}); 
        		});
		
			
		

                 });}
         , 1000);
}

function buyMarket(){
	hbsdk.get_balance('super-margin').then((res) =>{ 
        console.log(res.type);
        var tBalance = 0;
        for(var i=0;i<res.list.length;i++){
                if(res.list[i].currency=='usdt'){
                        console.log(res.list[i]);
                        if(res.list[i].type=='trade'){
                                tBalance=Number(res.list[i].balance);
                        }
                }       
                if(res.list[i].currency=='btc'){
                        console.log(res.list[i]);
                }
        }   
	
	if(tBalance>1){
	hbsdk.buy_market('super-margin', 'btcusdt', getScaledNumber(tBalance, 8)).then((res1)=>{
                console.log('buy result--'+res1);
                hbsdk.get_balance('super-margin').then((res2)=>{
                        for(var i=0;i<res2.list.length;i++){
                                if(res2.list[i].currency=='usdt'){
                                        console.log(res2.list[i]);
                                }   
                                if(res2.list[i].currency=='btc'){
                                        console.log(res2.list[i]);
                                }   
                        }   
                    
                }); 
        });
	}

        });
}

function sellMarket(){
	hbsdk.get_balance('super-margin').then((res) =>{ 
        console.log(res.type);
        var tBalance = 0;
        for(var i=0;i<res.list.length;i++){
                if(res.list[i].currency=='btc'){
                        console.log(res.list[i]);
                        if(res.list[i].type=='trade'){
                                tBalance=Number(res.list[i].balance);
                        }   
                }     
                if(res.list[i].currency=='usdt'){
                        console.log(res.list[i]);
                }   
        }   

	if(tBalance>0.00001){
	hbsdk.sell_market('super-margin', 'btcusdt', getScaledNumber(tBalance, 6)).then((res1)=>{
                console.log('sell result--'+res1);

                eventEmitter.emit('repaySignal');
        }); 
	}

	eventEmitter.emit('repaySignal');
        });
}

function getLatestOrder(accountType, symbol, state, type){
	hbsdk.search_order(accountType, symbol, state, type).then((res)=>{
		var latest = 0;
		var index;

//		console.log(res);

		for(var i=0;i<res.length;i++){
			if(res[i]['finished-at']>latest){
				latest = res[i]['finished-at'];
				index = i;
			}
		}
		hbsdk.order_detail(res[index].id).then((res1)=>{
			console.log(res1[0]);
		});
	});
}



function run() {
    

 

	scanKline();

	http.createServer(function (request, response) {

    // 发送 HTTP 头部
    // HTTP 状态值: 200 : OK
    // 内容类型: text/plain
    response.writeHead(200, {'Content-Type': 'text/plain'});

    
     response.write(log+'\n'+log1);
    response.end('\n');
}).listen(8888);


console.log('Server running at http://127.0.0.1:8888/');
//getLatestOrder('super-margin', 'btcusdt', 'filled', '');	

/*
    hbsdk.supermargin_transfer('usdt','100.0','out').then((res1) =>{
	
	console.log('transferId: '+res1);
	hbsdk.get_balance('super-margin').then((res) =>{ 
        console.log(res.type);
        	for(var i=0;i<res.list.length;i++){
                	if(res.list[i].currency=='usdt'){
                        	console.log(res.list[i]);
                	}	   
        	}   

    	});

	hbsdk.get_balance('spot').then((res) =>{ 
        console.log(res.type);
        	for(var i=0;i<res.list.length;i++){
                	if(res.list[i].currency=='usdt'){
                        	console.log(res.list[i]);
                	}   
        	}   

    	});  
 

	hbsdk.supermargin_loan_info().then(console.log);
    });

*/
    


    // 获取Balance和OpenOrders
    // hbsdk.get_open_orders('btcusdt').then(console.log);

    // 交易
    // hbsdk.buy_limit('ltcusdt', 0.01, 0.1);

    // 检查订单
    // hbsdk.get_order(377378515).then(console.log);

    // 提现
    // hbsdk.withdrawal('0x9edfe04c866d636526828e523a60501a37daf8f6', 'etc', 1);
}

run();
