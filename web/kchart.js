function reserve(arr){
	var revArr = new Array();
	for(var i=0;i<arr.length;i++){
		revArr[i] = arr[arr.length-1-i];
	}
	return revArr;
}

function getScaled(num ,dec){
	return num.toString().includes('.') && num.toString().split('.')[1].length>dec ? num.toString().split('.')[0]+ '.' + num.toString().split('.')[1].slice(0,dec) : num;
	//return num;
}

function formDate(str){
	return str.split('/')[1]=='0' ? str.split('/')[0]+':00' : str.split('/')[0]+':'+str.split('/')[1];
}


function setChartData(dataStr){
	var tempStr = JSON.parse(dataStr).kdata;
	var tempArr = new Array();
	for(var i=0;i<tempStr.split('|').length;i++){
		tempArr[i] = [tempStr.split('|')[i].split('-')[0], tempStr.split('|')[i].split('-')[1], tempStr.split('|')[i].split('-')[2], tempStr.split('|')[i].split('-')[3], tempStr.split('|')[i].split('-')[4], tempStr.split('|')[i].split('-')[5]];
	}

	var rawData = reserve(tempArr);
	var dates = rawData.map(function (item) {return formDate(item[5]);});

        var data = rawData.map(function (item) {return [+item[0], +item[1], +item[2], +item[3]];});

       	var amounts = rawData.map(function (item) {return item[4];});
	

	var tempStr1 = JSON.parse(dataStr).catalog;
	var tempArr1 = new Array();
	var tempArr2 = new Array();
	var tempArr3 = new Array();
	for(var i=0;i<tempStr1.split('&').length;i++){
		var curr = tempStr1.split('&')[i].split('|')[1];
		if(curr!='null'){
			tempArr1.push(tempStr1.split('&')[i].split('|')[0].replace('usdt','')+' ('+tempStr1.split('&')[i].split('|')[2]+')');
			tempArr2.push(tempStr1.split('&')[i].split('|')[1]);
			tempArr3.push(1+Number(tempStr1.split('&')[i].split('|')[2].replace('%',''))/100);
		}
	}

	var catalog = tempArr1;
	var tempJson = new Array;
	var currentBalance = 0;
	var oldBalance = 0;
	for(var i=0;i<catalog.length;i++){
		tempJson.push(JSON.parse('{"value":' + tempArr2[i]*tempArr3[i]+',"name":"'+catalog[i].replace('usdt', '')+'"}'));

		oldBalance += Number(tempArr2[i]);
		
		currentBalance += Number(tempArr2[i])*Number(tempArr3[i]);
	}


	var balanceStr = getScaled(currentBalance+Number(JSON.parse(dataStr).current_usdt_balance),2) +'usdt ('+getScaled((currentBalance-oldBalance), 2) +'usdt)';

	tempJson.push(JSON.parse('{"value":'+ JSON.parse(dataStr).current_usdt_balance +',"name":"*BALANCE*"}'));
	catalog.push('*BALANCE*');

        var option = {
        	backgroundColor: '#21202D',
                legend: {
                	data: ['日K', 'Amount'],
                        inactiveColor: '#777',
                        textStyle: {
                        	color: '#fff'
                        }
                },
                tooltip: {
                        trigger: 'axis',
                        axisPointer: {
                        	animation: false,
            			type: 'cross',
            			lineStyle: {
                			color: '#376df4',
                			width: 2,
                			opacity: 1
            			}
        		}
    		},
    		xAxis: {
        		type: 'category',
        		data: dates,
        		axisLine: { lineStyle: { color: '#8392A5' } }
    		},
    		yAxis: {
        		scale: true,
        		axisLine: { lineStyle: { color: '#8392A5' } },
        		splitLine: { show: false }
    		},
    		grid: {
        		bottom: 80
    		},
    		dataZoom: [{
        		textStyle: {
            			color: '#8392A5'
        		},
        		handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
                	handleSize: '80%',
                	dataBackground: {
                    		areaStyle: {
                        		color: '#8392A5'
                    		},
                    		lineStyle: {
                        		opacity: 0.8,
                        		color: '#8392A5'
                    		}
                	},
                	handleStyle: {
                    		color: '#fff',
                    		shadowBlur: 3,
                    		shadowColor: 'rgba(0, 0, 0, 0.6)',
                    		shadowOffsetX: 2,
                    		shadowOffsetY: 2
                	}
            	}, 
		{
                	type: 'inside'
            	}],
            	animation: true,
            	series: [{
                    	type: 'candlestick',
                    	name: '日K',
                    	data: data,
			animationDelay: function (idx) {
            			return idx * 5;
        		},
                    	itemStyle: {
                        	color: '#0CF49B',
                        	color0: '#FD1050',
                        	borderColor: '#0CF49B',
                        	borderColor0: '#FD1050'
                    	}
                }/*,

                {
                    name: 'Amount',
                    type: 'custom',
                    data: amounts,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 1
                    }
                }
                */
            	]//,
		//animationEasing: 'elasticOut',
    		//animationDelayUpdate: function (idx) {
        	//	return idx * 5;
    		//}
	};

        myChart.setOption(option);



	





	option1 = {
    title: {
        text: balanceStr,
        subtext: '',
        left: 'center'
    },
    tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b} : {c} ({d}%)'
    },
    legend: {
        orient: 'vertical',
        left: 'left',
        data: catalog
    },
    series: [
        {
            name: 'currency',
            type: 'pie',
            radius: '55%',
            center: ['50%', '60%'],
            data: tempJson,
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }
    ]
};

myChart1.setOption(option1);

}
