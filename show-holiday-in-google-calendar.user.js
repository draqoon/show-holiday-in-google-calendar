// ==UserScript==
// @name         show-holiday-in-google-calendar
// @namespace    https://calendar.google.com/calendar/render
// @version      1.0
// @description  Show Holiday in Google Calendar
// @author       Tatsuo Sanno
// @match        https://calendar.google.com/calendar/render*
// @grant        none
// ==/UserScript==

var GOOGLE_API_KEY = localStorage.getItem("google_api_key_calendar");
console.log("google_api_key_calendar =", GOOGLE_API_KEY);
var CALENDAR_ID = 'japanese__ja@holiday.calendar.google.com';

(function() {
    'use strict';

    var HOLIDAY_FGCOLOR  = "red";
    var HOLIDAY_BGCOLOR  = "mistyrose";
    var SUNDAY_BGCOLOR   = "mistyrose";
    var SATURDAY_BGCOLOR = "lightcyan";

    function $$(selector) { return document.querySelectorAll(selector) || []; }
    function $(id) { return document.getElementById(id); }

    function date2str(date) {
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var d = date.getDate();
        if( m < 10 ) m = "0" + m;
        if( d < 10 ) d = "0" + d;
        return y + "-" + m + "-" + d;
    }

    function CurrentMonth( text ) {
        var r = /([0-9]+)年 ?([0-9]+)月/.exec( text );
        this.year = parseInt(r[1]);
        this.month = parseInt(r[2]);
        this.prev = new Date(this.year, this.month - 2, 1); //前月の初日
        this.next = new Date(this.year, this.month + 1, 0); //翌月の末日
        this.key = text;
    }
    CurrentMonth.prototype = {
        createDate: function(text, isCurrentMonth) {
            var r = /([0-9]+)月 1日/.exec( text );
            if( r ) {
                var m = parseInt(r[1]);
                if( !isCurrentMonth && m == 1 )
                    return new Date(this.year + 1, m - 1, 1);
                else
                    return new Date(this.year, m - 1, 1);
            }
            else {
                r = /([0-9]+)/.exec(text);
                if(r) {
                    var d = parseInt(r[1]);
                    if( isCurrentMonth ) {
                        //当月
                        return new Date(this.year, this.month - 1, d);
                    }
                    else if( 15 < d ) {
                        //前月
                        if( this.month === 1 )
                            return new Date(this.year - 1, 11, d);
                        else
                            return new Date(this.year, this.month - 2, d);
                    }
                    else {
                        //次月
                        if( this.month === 12 )
                            return new Date(this.year + 1, 0, d);
                        else
                            return new Date(this.year, this.month, d);
                    }
                }
            }
            return null;
        }
    };

    //----------------------------------------------------------------
    // DOMが変化した時に、祝日描画処理を行う
    //----------------------------------------------------------------
    var _loading = false;
    document.addEventListener("DOMSubtreeModified", function(){
        if( _loading ) return;
        _loading = true;
        setTimeout(onDOMSubtreeModifiedAsync, 10);
    }, false);
    function onDOMSubtreeModifiedAsync() {
        showHoliday();
        addPreferenceButton();
        _loading = false;
    }

    //----------------------------------------------------------------
    // Google Calendar API を利用して、祝日リストを取得
    //----------------------------------------------------------------
    var currentMonth;
    var holidaysCache = {};
    function showHoliday() {
        // 表示中の年月(yyyy年m月)
        var key = $("dp_0_cur").textContent;

        // 祝日を取得済の月はキャッシュから取得後、祝日描画
        // カレンダー描画時に複数回DOMが更新されるため、キャッシュしないと無駄なAPIコールが発生する
        currentMonth = new CurrentMonth( key );
        if( key in holidaysCache ) {
            printHoliday();
            printHolidayMini();
            return;
        }

        //祝日の取得＆適用
        var timeMin = date2str(currentMonth.prev) + 'T00:00:00+0900';
        var timeMax = date2str(currentMonth.next) + 'T23:59:59+0900';
        //console.log(timeMin, timeMax);
        // Google Calendar API V3のURL
        var apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/' +
            encodeURIComponent( CALENDAR_ID ) + '/events' +
            '?key=' + GOOGLE_API_KEY +
            '&timeMin=' + encodeURIComponent( timeMin ) +
            '&timeMax=' + encodeURIComponent( timeMax ) +
            '&fields=items(start,summary)';

        fetch(apiUrl, { method:'GET' }).then(function(res){
            return res.json();
        }).then(function(holidays) {
            //取得した祝日リストをキャッシュに保存後、祝日描画
            holidaysCache[currentMonth.key] = holidays;
            printHoliday();
        });
    }

    //----------------------------------------------------------------
    // 祝日と土日を描画
    //----------------------------------------------------------------
    function printHoliday() {
        var holidays = holidaysCache[currentMonth.key];

        Array.prototype.some.call($$("td.st-dtitle"), function(td) {
            //日付の取得
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
            var ymdstr = date2str(ymd);

            if(0 < (td.querySelectorAll("span.holiday") || []).length) return false;

            //祝日の行の背景色変更
            var is_holiday = holidays.items.some(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    //祝日の場合は、祝日名を設定
                    var span_holiday = createElement("span", {className:"holiday", style:{color:HOLIDAY_FGCOLOR, paddingLeft:"10px"}}, holiday.summary);
                    td.appendChild(span_holiday);
                    return true;
                }
            });

            try {
                //枠の背景色の着色
                var dayOfWeek = ymd.getDay();
                if( is_holiday || dayOfWeek === 0 || dayOfWeek === 6 ) {
                    //左から何列目か
                    var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                    //枠テーブルのセルを検索
                    var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                    var td_box = xpathresult.singleNodeValue;
                    if( is_holiday ) { //祝日
                        td_box.style.backgroundColor = HOLIDAY_BGCOLOR;
                        td.style.backgroundColor = HOLIDAY_BGCOLOR;
                    }
                    else if( dayOfWeek === 0 ) { //日曜日
                        td_box.style.backgroundColor = SUNDAY_BGCOLOR;
                        td.style.backgroundColor = SUNDAY_BGCOLOR;
                    }
                    else if( dayOfWeek === 6 ) { //土曜日
                        td_box.style.backgroundColor = SATURDAY_BGCOLOR;
                        td.style.backgroundColor = SATURDAY_BGCOLOR;
                    }
                }
            }
            catch(ex){
                console.log(ex);
            }

        });
    }

    //----------------------------------------------------------------
    // 祝日と土日を描画(ミニカレンダー)
    //----------------------------------------------------------------
    function printHolidayMini() {
        var holidays = holidaysCache[currentMonth.key];

        Array.prototype.some.call($$("#dp_0_tbl td.dp-cell"), function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //日付の取得
            var ymd = currentMonth.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            //祝日の行の背景色変更
            var is_holiday = holidays.items.some(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    td.title = holiday.summary;
                    return true;
                }
                else {
                    return false;
                }
            });
            var dayOfWeek = ymd.getDay();
            if( is_holiday ) { //祝日
                td.style.backgroundColor = HOLIDAY_BGCOLOR;
            }
            else if( dayOfWeek === 0 ) { //日曜日
                td.style.backgroundColor = SUNDAY_BGCOLOR;
            }
            else if( dayOfWeek === 6 ) { //土曜日
                td.style.backgroundColor = SATURDAY_BGCOLOR;
            }
        });
    }

    function createElement(tagName, attributes, textContent) {
        var element = document.createElement(tagName);
        for( var key in attributes ) {
            if( (attributes[key] instanceof Object) && !(attributes[key] instanceof Array) ) {
                element[key] = {};
                for( var key2 in attributes[key] )
                    element[key][key2] = attributes[key][key2];
            }
            else {
                element.setAttribute(key, attributes[key]);
            }
        }
        element.textContent = textContent;
        return element;
    }

    function addPreferenceButton() {
        //メニューが未作成時は何もしない
        var menu = document.querySelector("body > div.goog-menu.goog-menu-vertical");
        if( !menu )return;

        //メニューアイテムを追加済の場合は何もしない
        var z = document.getElementById(":z");
        if(z)return;

        //仕切りを追加
        var separator = createElement("div", {class:"goog-menuseparator", "aria-disabled":"true", style:"-webkit-user-select:none", role:"separator", id:":y"});
        menu.appendChild(separator);

        //メニューアイテムを追加
        var menuitemp = createElement("div", {class:"goog-menuitem", role:"menuitem", style:"-webkit-user-select: none", id:":z"});
        menuitemp.addEventListener("mouseover", function() { menuitemp.classList.add("goog-menuitem-highlight"); });
        menuitemp.addEventListener("mouseout", function() { menuitemp.classList.remove("goog-menuitem-highlight"); });
        menu.appendChild(menuitemp);
        //メニューアイテム(テキスト)を追加
        var menuitemc = createElement("div", {class:"goog-menuitem-content", style:"-webkit-user-select: none"}, "祝日設定");
        menuitemp.appendChild(menuitemc);

        menuitemp.addEventListener("click", function() {
            //メニューを閉じる
            var menubtn = document.getElementById("mg-settings");
            menubtn.classList.remove("goog-imageless-button-hover");
            menubtn.classList.remove("goog-imageless-button-focused");
            menubtn.classList.remove("goog-imageless-button-open");
            menu.style.display = "none";

            var body = document.getElementsByTagName('body')[0];

            var screenSize = getScreenSize();
            //背景を追加
            var dialogback = createElement("div", {id:"dialogprefback", style:{ position:"absolute", top:"0px", left:"0px", height:screenSize.height+"px", width:"100%", backgroundColor:"black", opacity:"0.5" }});
            body.appendChild(dialogback);

            //ダイアログを追加
            var dialog = createElement("div", {id:"dialogpref", style:{ position:"absolute", height:"90px", width:"450px", top:(screenSize.height-90)/2 + "px", left:(screenSize.width-450)/2 +"px", border:"1px solid black", backgroundColor:"white", padding:"15px" }});
            body.appendChild(dialog);

            dialogback.addEventListener("click", function() {
                closePrefence();
            });

            var msg = createElement("div", {style:{marginBottom:"15px"}}, "Google API キーを設定してください。");
            dialog.appendChild(msg);

            var textbox = createElement("input", {id:"txtGoogleApiKey", type:"textbox", size:45, value:localStorage.getItem("google_api_key_calendar")});
            var label = createElement("label", {htmlFor:textbox.id}, "Google API キー");
            dialog.appendChild(label);
            dialog.appendChild(textbox);

            var btnarea = createElement("div", {id:"btnarea", style:{position:"absolute", right:"15px", bottom:"15px"}});
            dialog.appendChild(btnarea);

            var btnOK = createElement("input", {id:"btnOK", type:"button", value:"OK", style:{marginRight:"5px", width:"60px", height:"25px"}});
            btnOK.addEventListener("click", function() {
                localStorage.setItem("google_api_key_calendar", textbox.value);
                location.reload();
                closePrefence();
            });
            btnarea.appendChild(btnOK);

            var btnCancel = createElement("input", {id:"btnCancel", type:"button", value:"Cancel", style:{width:"60px", height:"25px"}});
            btnCancel.addEventListener("click", function() {
                closePrefence();
            });
            btnarea.appendChild(btnCancel);

            function closePrefence() {
                body.removeChild(dialogback);
                body.removeChild(dialog);
            }
        });
    }

    // 画面サイズを取得
    function getScreenSize() {
        var h = 0;
        var w = 0;
        if ( window.innerHeight && window.innerWidth ) {
            h = window.innerHeight;
            w = window.innerWidth;
        }
        else if ( document.documentElement && document.documentElement.clientHeight !== 0 && document.documentElement.clientWidth !== 0 ) {
            h = document.documentElement.clientHeight;
            w = document.documentElement.clientWidth;
        }
        else if ( document.body ) {
            h = document.body.clientHeight;
            w = document.body.clientWidth;
        }
        return { height:h, width:w };
    }

})();
