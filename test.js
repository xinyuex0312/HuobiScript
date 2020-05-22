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
	var s = num.toString().split('.')[0]+'.'+num.toString().split('.')[1].slice(0,n);
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
		//console.log(res);
		if(loanAmount>1){
		hbsdk.supermargin_loan('usdt', getScaledNumber(loanAmount, 3)).then((res1)=>{
		        console.log('loanID: '+res1);
                        hbsdk.supermargin_loan_orders('accrual').then(console.log);

        //                eventEmitter.emit('buySignal');
                }); 
		}
		else{
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

function rsiStrategy(rsi){
	
	console.log('current rsi(当前rsi): '+rsi[0]);
	console.log('history rsi(历史rsi): '+ rsi.slice(1,4).join(' - '))

	if(rsi[1]<50&&rsi[1]<rsi[2]&&rsi[2]<rsi[3]){
		if(rsi[0]>rsi[1]){
			return 'buy';
		}
		else{
			return 'hold';
		}
	}

	else if(rsi>70){
		return 'sell';
	}

	else{
		return 'hold';
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
	if(price1>=price2){
		return 'profit(预估单位盈利): '+getScaledNumber((price1-price2),3)+'\npercentage(百分比): +'+ getScaledNumber((price1-price2)/price2*100, 4)+'%\nactual profit(预估实际盈利): '+getScaledNumber(amount*(price1-price2)/price2,3)+' usdt';
	}
	else if(price2>price1){
		return 'loss(预估单位损失): '+getScaledNumber((price2-price1),3)+'\npercentage(百分比): -'+ getScaledNumber((price2-price1)/price2*100, 4)+'%\nactual loss(预估实际损失): '+getScaledNumber(amount*(price2-price1)/price2,3)+' usdt';
	}
	
}


function testRsiStra(rsi){

	var buyIndex = '';

	var lx = 30;

	for(var i=0;i<rsi.length-3;i++){
		if(rsi[i]>rsi[i+1]&&rsi[i+1]<lx&&rsi[i+2]>rsi[i+1]&&rsi[i+3]>rsi[i+2]){
			buyIndex += ','+i.toString();
		}
	}

	return buyIndex.split(',').slice(1,buyIndex.split(',').length);

	

}

function testRsiStra1(rsi){

        var buyIndex = ''; 

        var lx = 70; 

        for(var i=0;i<rsi.length-3;i++){
                if(rsi[i]>rsi[i+1]+11&&rsi[i+1]<lx&&rsi[i+2]>rsi[i+1]&&rsi[i+1]>30){
                        buyIndex += ','+i.toString();
			console.log(rsi[i]);
                }   
        }   

        return buyIndex.split(',').slice(1,buyIndex.split(',').length);

}

function testMixStra(data){
	var rsi = rsiGenerator(14, data);
	var buyIndex = ''; 

        var lx = 30; 

        for(var i=0;i<rsi.length-3;i++){
                if(rsi[i]>rsi[i+1]&&rsi[i+1]<lx&&rsi[i+2]>rsi[i+1]&&rsi[i+3]>rsi[i+2]){
                        buyIndex += ','+i.toString();
                }   
        }   

        var buyArr = buyIndex.split(',').slice(1,buyIndex.split(',').length);	

	var ma5 = maGenerator(5, data);
	var ma10 = maGenerator(10, data);
	var ma30 = maGenerator(30, data);
	var macd = barGenerator(data);

	var arr = '';

	for(var i=0;i<buyArr.length;i++){
		var index = Number(buyArr[i]);
		var temp = data[index].close;
		//console.log(index);
		if(macd[index]>macd[index+1]){
			arr += ','+index;
		}
	}

	return arr.split(',').slice(1, arr.split(',').length);

}


function test(){

	const sound = require('sound-play');
	sound.play("coin.mp3");

	hbsdk.get_kline('btcusdt','15min','2000').then((res) =>{
	//	var buyArr = testRsiStra(rsiGenerator(14, res)); 

		var buyArr = testMixStra(res);
		console.log(buyArr);
		//console.log(arr1);

		//for(var i=0;i<arr1.length;i++){
		//	console.log(timeConverter(res[arr1[i]].id));
		//}

		var high = 0;
		var low = 99999;
	
		var c = 0;
		var tx= 1.5;
 
		for(var i=0;i<res.length;i++){
			for(var j=0;j<buyArr.length;j++){
				if(i==buyArr[j]){
					console.log('highest price: '+high+'   --   '+getScaledNumber((high-(res[i].close+res[i].open)/2)/((res[i].close+res[i].open)/2)*100, 3));
					
					if((high-(res[i].close+res[i].open)/2)/((res[i].close+res[i].open)/2)*100>tx){
						c += 1;

					}

					console.log('lowest price: '+low);
					console.log('buy point '+ timeConverter(res[i].id)+' price is '+(res[i].close+res[i].open)/2+'\n----------------');
					high = 0;
					low = 99999;
				}
				else{
					if(res[i].high>high){
						high = res[i].high;
					}
					if(res[i].low<low){
						low = res[i].low;
					}
				}
			}

		}

		console.log('*****'+c+'*****'+buyArr.length+'*******'+c/buyArr.length+'******************');
	});
}


function test2(){
	hbsdk.get_kline('btcusdt','15min','2000').then((res) =>{

		var sum = 0;
		var c = 0
		for(var i=1;i<res.length-1;i++){
			if(res[i].close>res[i].open&&res[i].amount>res[i+1].amount*4){
				sum += 1;
				console.log(timeConverter(res[i].id)+'********'+(res[i-1].close-res[i].close));
				if(res[i-1].close-res[i].close>0){

					c += 1;
				}
			}
		}
		console.log(c/sum);

	});

}


function scanKline(){	
	setInterval(function(){hbsdk.get_kline('btcusdt','15min','200').then((res) =>{
			var signal;
			rsi = rsiGenerator(14, res);
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
					
						console.log('------------wait for sell(等待卖出)------------\ncurrent price(当前价格): '+res[0].close);
						console.log(priceCompare(res[0].close, detailRes[0].price, orderRes[index].amount));	
						console.log('Bought-in price(买入价): '+detailRes[0].price);
                                         	console.log('Expected sell price(期望卖出价): '+getScaledNumber(detailRes[0].price*1.012, 3));
						console.log('Stop loss sell price(止损卖出价): '+getScaledNumber(detailRes[0].price*0.995, 3));                                       
 
						if(res[0].close>detailRes[0].price*1.012){
							signal = 'sell';
						}
						else{
							signal = 'hold';
						}
 
                           			
					}

					else if(detailRes[0].type=='sell-market'){
						console.log('------------wait for buy(等待买入)-------------');			
						console.log('current price(当前价格): '+res[0].close);			
			
						signal = signalFilter(rsiStrategy(rsi), 'sell');		
                              
					}

					console.log('----------------Signal: '+signal+'-----------------\n\n');

					switch(signal){
                                                 case 'buy': eventEmitter.emit('loanSignal'); break;
                                                 case 'sell': eventEmitter.emit('sellSignal'); break;
                                                 default : break;
                                        }
	
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
    // 准备工作，填写config/default.json中的:
    // access_key & secretkey, www.huobi.com上申请
    // account_id 登陆后看自己的UID
    // trade_password 可以先不填，提现时需要

    // 第一步，获取account_id
    // hbsdk.get_account().then(console.log);
    // 把get_account获取到的type=spot的id填写到:
    // default.json中的${account_id_pro}中去
   	test(); 
	//test2();
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
    


    // 第二步，获取Balance和OpenOrders
    // hbsdk.get_open_orders('btcusdt').then(console.log);

    // 第三步，交易
    // hbsdk.buy_limit('ltcusdt', 0.01, 0.1);

    // 第四步，检查订单
    // hbsdk.get_order(377378515).then(console.log);

    // 第五步，提现
    // 先去网站上设置好安全提现地址
    // 欢迎打赏到我的钱包，我可以协助测试 ^^
    // hbsdk.withdrawal('0x9edfe04c866d636526828e523a60501a37daf8f6', 'etc', 1);
}

run();
