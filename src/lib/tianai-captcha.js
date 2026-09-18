import axios from "axios";
//import '../assets/style/tianai-captcha.css'

class TianaiCaptcha {
  constructor(config) {
    this.config = config;

    this.config.postConfig = this.config.postConfig || {
      captchaParamName:'_tianaiCaptcha',
      tokenParamName:'_tianaiCaptchaToken'
    }
    this.config.slider = this.config.slider || this.sliderConfig();
    this.config.rotate = this.config.rotate || this.rotateConfig();
    this.config.concat = this.config.concat || this.concatConfig();

    this.config.dateFormat = this.config.dateFormat || "yyyy-MM-dd HH:mm:ss'";
    this.config.loadingText = this.config.loadingText || '';
    this.config.title = this.config.title || '安全验证'
    this.config.validText = this.config.validText || ''
    this.config.width = this.config.width || 400;
    this.config.showMerchantName = this.config.showMerchantName === undefined ? true : this.config.showMerchantName;
    this.config.success = this.config.success || console.info;
    this.config.fail = this.config.fail || console.error;
    this.config.failRefreshCaptcha = this.config.failRefreshCaptcha === undefined ? true : this.config.failRefreshCaptcha;

    if (!this.config.baseUrl) {
      this.config.baseUrl = "$baseUrlToken$";
    }

    this.http = axios.create({baseURL:this.config.baseUrl});

    // 与 validValue 解耦的稳定引用，否则 doGenerateHtml 重置 validValue 后 removeEventListener 无法成对移除
    this._onGlobalPointerMove = this.move.bind(this);
    this._onGlobalPointerUp = this.up.bind(this);
    this._onSliderDown = this.sliderDown.bind(this);
    this._globalPointerCapture = true;
    this._pointerDragEl = null;
    this._pointerCaptureId = null;

    this.containerTemplate = `<div class="__tianai-container" id="tianai-container"></div>`

    this.contentTemplate = `
        <div class="__tianai-content" style="width:${this.config.width}px" id="tianai-content">
          <div class="__tianai-content-title" id="tianai-content-title">
            <div class="__tianai-content-title-text">${this.config.title}</div>
            <div class="__tianai-content-title-close" id="tianai-content-close-btn"></div>
          </div>
        </div>
    `
    this.imageContentTemplate =`
        <div class="__tianai-content-image-bg" id="tianai-content-image-bg">
        </div>
        <div class="__tianai-content-target" id="tianai-image-content-target">
        </div>
    `
    this.contentWrapper = `<div class="__tianai-content-image-wrapper" id="tianai-content-image-wrapper"></div>`

    this.contentOperate = `
        <div class="__tianai-slider-move">
          <div class="__tianai-slider-move-track" id="tianai-slider-move-track">
            
          </div>
          <div class="__tianai-btn __tianai-slider-move-btn" id="tianai-slider-move-btn">
          </div>
        </div>
        <div class="__tianai-operating">
        
          <div class="__tianai-operating-merchant" id="tianai-operating-merchant">
            
          </div>
          
          <div class="__tianai-operating-btn">
            <div class="__tianai-btn __tianai-operating-refresh-btn" id="tianai-operating-refresh-btn">
            </div>
            <div class="__tianai-btn __tianai-operating-close-btn" id="tianai-operating-close-btn">
            </div>
          </div>
        </div>
    `
  }
  sliderConfig() {
    return {
      prompt:"滑动拼图块完成验证",
      onMove:this.sliderMove
    }
  }
  rotateConfig() {
    return {
      prompt:"滑动旋转角度完成验证",
      onMove:this.rotateMove
    }
  }
  concatConfig() {
    return {
      prompt:"滑动拼接图片完成验证",
      onMove:this.concatMove
    }
  }
  show() {

    if (import.meta.env.VITE_NODE_ENV !== 'development') {

      let query = document.querySelector("link[id='tianai-captcha']");

      if (!query) {
        let script = document.createElement("link");
        script.id = "tianai-captcha";
        script.type = "text/css";
        script.href = this.config.baseUrl + "/tianai-captcha.css"
        script.rel="stylesheet";
        script.onerror = this.config.fail;
        script.onload = () => this.doShow();
        document.body.appendChild(script);
      } else {
        this.doShow();
      }
    } else {
      this.doShow();
    }

  }
  doShow() {
    let tianaiContent = document.getElementById("tianai-content");

    if (!tianaiContent) {
      let container = this.config.container;
      if (!container) {
        container = document.body;
      } else {
        container = document.getElementById(this.config.container);
      }
      container.insertAdjacentHTML('beforeend',this.containerTemplate);
      container.lastElementChild.insertAdjacentHTML('beforeend',this.contentTemplate);
      this.fadeIn(container.lastElementChild);

      document.getElementById("tianai-content-close-btn").addEventListener("click", this.hide.bind(this));
    }

    this.generateCaptcha();
  }
  generateCaptcha(lading = true) {
    if (lading) {
      this.loading(this.config.loadingText);
    }
    let param = this.config.postConfig.tokenParamName + "=" + this.config.token + "&captchaType=tianai&generateImageType=" + (this.config.generateType || 'random');

    return this.http
        .get("/captcha/generateCaptcha?" + param)
        .then(r => this.doGenerateHtml(r.data.data))
        .catch((e) => {
          if (e.response.data) {
            const data = e.response.data;
            if (data.executeCode && data.executeCode === '10404') {
              axios.get(this.config.baseUrl + "/captcha/generateToken?type=tianai").then(r => {
                this.config.token = r.data.data.token.name;
                this.generateCaptcha(lading);
              });
            } else {
              this.config.fail(e);
            }
          } else {
            this.config.fail(e);
          }
        });
  }
  doGenerateHtml(data) {
    this.generateData = data;
    this.removeLoading();
    this.detachGlobalPointerListeners();

    const tianaiTitle = document.getElementById("tianai-content-title");

    let sliderMoveBtn = document.getElementById("tianai-slider-move-btn");
    if (!sliderMoveBtn) {
      tianaiTitle.insertAdjacentHTML('afterend',this.contentOperate);
      sliderMoveBtn = document.getElementById("tianai-slider-move-btn");
      if (typeof window !== "undefined" && window.PointerEvent) {
        sliderMoveBtn.addEventListener("pointerdown", this._onSliderDown, { passive: false });
      } else {
        sliderMoveBtn.addEventListener("mousedown", this._onSliderDown);
        sliderMoveBtn.addEventListener("touchstart", this._onSliderDown, { passive: false });
      }

      const refreshBtn = document.getElementById("tianai-operating-refresh-btn");
      refreshBtn.addEventListener("click", this.generateCaptcha.bind(this));

      const closeBtn = document.getElementById("tianai-operating-close-btn");
      closeBtn.addEventListener("click", this.cancel.bind(this));
      if (this.config.showMerchantName && data.merchantName) {
        const merchant = document.getElementById("tianai-operating-merchant");
        merchant.innerHTML = data.merchantName || '';
      }
    }

    this.applySliderTouchStyle(sliderMoveBtn);

    let wrapper = document.getElementById("tianai-content-image-wrapper");
    if (!wrapper) {
      tianaiTitle.insertAdjacentHTML('afterend',this.contentWrapper);
      wrapper = document.getElementById("tianai-content-image-wrapper");
      wrapper.insertAdjacentHTML('beforeend', this.imageContentTemplate);
    } else {
      const oldImageBg = document.getElementById("tianai-content-image-bg");
      this.removeElement(oldImageBg);
      const oldImageTarget = document.getElementById("tianai-image-content-target");
      this.removeElement(oldImageTarget);
      wrapper.insertAdjacentHTML('beforeend', this.imageContentTemplate);
      //Array.from(wrapper.children).forEach(el => this.fadeIn(el));
    }

    const imageBg = document.getElementById("tianai-content-image-bg");
    let img = imageBg.lastElementChild;
    if (!img) {
      imageBg.insertAdjacentHTML('beforeend', `<img src="${data.backgroundImage}">`);
    } else {
      img.src = data.backgroundImage;
    }

    this.validValue = {
      startX:0,
      startY:0,
      startTime:new Date(),
      trackArr:[]
    };

    const targetBg = document.getElementById("tianai-image-content-target");

    if (["slider","rotate"].includes(data.type)) {
      const targetTemplate = document.getElementById("image-content-target-template");

      if (targetTemplate) {
        targetTemplate.src = data.templateImage;
      } else {
        targetBg.insertAdjacentHTML('beforeend', `<img src="${data.templateImage}" id="image-content-target-template">`);
      }
    } else {
      const targetTemplate = document.getElementById("image-content-target-template");
      if (targetTemplate) {
        this.fadeOut(targetTemplate);
      }

      targetBg.style.backgroundImage = "url(" + data.backgroundImage + ")";
      targetBg.style.backgroundPosition = "0px 0px";

      const backgroundImageHeight = data.backgroundImageHeight;
      targetBg.style.height = backgroundImageHeight - data.data.viewData.randomY + "px";

    }

    document.getElementById("tianai-slider-move-track").innerHTML = this.config[data.type]?.prompt || '拖动完成验证';

    setTimeout(() => {
      this.validValue.bgImageWidth = imageBg.offsetWidth;
      this.validValue.bgImageHeight = imageBg.offsetHeight;

      this.validValue.end = this.config.width - sliderMoveBtn.offsetWidth;

      if ("slider" === data.type) {
        this.validValue.sliderImageWidth = targetBg.lastElementChild.offsetWidth;
        this.validValue.sliderImageHeight = targetBg.lastElementChild.offsetHeight;
      } else if ("rotate" === data.type) {
        this.validValue.bgImageWidth = (data.degree + data.randomX) - this.validValue.bgImageHeight / 10;
      }
    }, 500);

    targetBg.classList.add(data.type.toLowerCase());
    this.returnToActualPosition(sliderMoveBtn);
  }
  removeElement(el) {
    if (!el) {
      return ;
    }
    el.remove();
  }
  returnToActualPosition(el) {
    if (el.style.transform !== '' && el.style.transform !== 'translate(0px, 0px)') {
      el.style.transition = "transform 0.5s ease";
      el.style.transform = "translate(0px, 0px)";
      el.addEventListener("transitionend", (e) => el.style.transition = "none");
    }
  }
  fadeIn(el) {
    el.style.transition = "opacity 0.5s ease";
    el.style.opacity = "0";
    setTimeout(() => {
      el.style.opacity = "1";
      el.addEventListener("transitionend", () => el.style.transition = "none");
    }, 100);
  }
  fadeOut(el) {
    el.style.transition = "opacity 0.5s ease";
    el.style.opacity = "0";
    el.addEventListener("transitionend", () => el.remove());

  }
  formUrlEncoded(json, ignoreProperties, valueConvert) {
    let param = new URLSearchParams();

    let ignore = [];

    if (typeof ignoreProperties === 'string') {
      ignore.push(ignoreProperties);
    } else {
      ignore = ignoreProperties || [];
    }

    for (let j in json) {

      if (ignore.includes(j)) {
        continue;
      }

      let val = json[j];

      if (val === undefined || val === null) {
        continue;
      }

      if (valueConvert) {
        val = valueConvert(j, val);
      }

      if (Array.isArray(val)) {
        val.forEach(v => param.append(j, v));
      } else {
        param.append(j, val);
      }

    }

    return param;
  }
  cancel(e) {
    const cancelFn = this.config?.cancel;
    if (typeof cancelFn === 'function') {
      const hide = cancelFn.call(this.config);
      if (hide === false) {
        return;
      }
    }
    this.hide(e);
  }
  hide(e) {
    const target = document.getElementById("tianai-container");
    if (!target) {
      return ;
    }
    this.detachGlobalPointerListeners();
    this.fadeOut(target);
  }
  detachGlobalPointerListeners() {
    if (this._pointerDragEl) {
      this._pointerDragEl.removeEventListener("pointermove", this._onGlobalPointerMove);
      this._pointerDragEl.removeEventListener("pointerup", this._onGlobalPointerUp);
      this._pointerDragEl.removeEventListener("pointercancel", this._onGlobalPointerUp);
      if (this._pointerCaptureId != null) {
        try {
          if (this._pointerDragEl.hasPointerCapture && this._pointerDragEl.hasPointerCapture(this._pointerCaptureId)) {
            this._pointerDragEl.releasePointerCapture(this._pointerCaptureId);
          }
        } catch (_) { /* noop */ }
      }
      this._pointerDragEl = null;
      this._pointerCaptureId = null;
    }
    const cap = this._globalPointerCapture;
    const touchOpts = { capture: cap, passive: false };
    document.removeEventListener("mousemove", this._onGlobalPointerMove, cap);
    document.removeEventListener("mouseup", this._onGlobalPointerUp, cap);
    document.removeEventListener("touchmove", this._onGlobalPointerMove, touchOpts);
    document.removeEventListener("touchend", this._onGlobalPointerUp, cap);
    document.removeEventListener("touchcancel", this._onGlobalPointerUp, cap);
  }
  applySliderTouchStyle(sliderMoveBtn) {
    if (!sliderMoveBtn) {
      return;
    }
    sliderMoveBtn.style.touchAction = "none";
    sliderMoveBtn.style.webkitUserSelect = "none";
    sliderMoveBtn.style.userSelect = "none";
    const row = sliderMoveBtn.parentElement;
    if (row) {
      row.style.touchAction = "none";
    }
  }
  getPointerPageXY(source) {
    if (!source) {
      return { x: 0, y: 0 };
    }
    let x = source.pageX;
    let y = source.pageY;
    if (x == null || y == null) {
      const sx = window.scrollX != null ? window.scrollX : window.pageXOffset;
      const sy = window.scrollY != null ? window.scrollY : window.pageYOffset;
      x = source.clientX + sx;
      y = source.clientY + sy;
    }
    return { x: Math.round(x), y: Math.round(y) };
  }
  sliderDown(event) {
    if (typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent) {
      if (!event.isPrimary) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
    } else if (event.type === "mousedown" && event.button !== 0) {
      return;
    }

    if (event.cancelable) {
      const isTouchLike =
        event.type === "touchstart" ||
        (typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent && event.pointerType === "touch");
      if (isTouchLike) {
        event.preventDefault();
      }
    }

    let startX;
    let startY;
    if (typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent) {
      const p = this.getPointerPageXY(event);
      startX = p.x;
      startY = p.y;
    } else if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      const touch = (event.targetTouches && event.targetTouches[0]) || event.touches[0];
      const p = this.getPointerPageXY(touch);
      startX = p.x;
      startY = p.y;
    } else {
      const p = this.getPointerPageXY(event);
      startX = p.x;
      startY = p.y;
    }

    this.validValue.startX = startX;
    this.validValue.startY = startY;

    const pageX = this.validValue.startX;
    const pageY = this.validValue.startY;

    const startTime = this.validValue.startTime;
    const trackArr = this.validValue.trackArr;

    trackArr.push({
      x: pageX - startX,
      y: pageY - startY,
      type: "down",
      t: (new Date().getTime() - startTime.getTime())
    });

    this.detachGlobalPointerListeners();

    const usePointerPath = typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent;
    if (usePointerPath) {
      const target = event.currentTarget;
      try {
        target.setPointerCapture(event.pointerId);
      } catch (_) { /* noop */ }
      this._pointerDragEl = target;
      this._pointerCaptureId = event.pointerId;
      target.addEventListener("pointermove", this._onGlobalPointerMove);
      target.addEventListener("pointerup", this._onGlobalPointerUp);
      target.addEventListener("pointercancel", this._onGlobalPointerUp);
      return;
    }

    const cap = this._globalPointerCapture;
    const touchOpts = { capture: cap, passive: false };
    document.addEventListener("mousemove", this._onGlobalPointerMove, cap);
    document.addEventListener("mouseup", this._onGlobalPointerUp, cap);
    document.addEventListener("touchmove", this._onGlobalPointerMove, touchOpts);
    document.addEventListener("touchend", this._onGlobalPointerUp, cap);
    document.addEventListener("touchcancel", this._onGlobalPointerUp, cap);
  }
  move(event) {
    let pointer = event;
    if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      if (event.cancelable) {
        event.preventDefault();
      }
      pointer = event.touches[0] || event.changedTouches[0];
      if (!pointer) {
        return;
      }
    } else if (typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent) {
      if (event.pointerType === "touch" && event.cancelable) {
        event.preventDefault();
      }
      pointer = event;
    }
    const xy = this.getPointerPageXY(pointer);
    let pageX = xy.x;
    let pageY = xy.y;

    const startX = this.validValue.startX;
    const startY = this.validValue.startY;

    const startTime = this.validValue.startTime;
    const end = this.validValue.end;

    const bgImageWidth = this.validValue.bgImageWidth;
    const trackArr = this.validValue.trackArr;

    let moveX = pageX - startX;
    const track = {
      x: pageX - startX,
      y: pageY - startY,
      type: "move",
      t: (new Date().getTime() - startTime.getTime())
    };
    trackArr.push(track);
    if (moveX < 0) {
      moveX = 0;
    } else if (moveX > end) {
      moveX = end;
    }
    this.validValue.moveX = moveX;
    this.validValue.movePercent = moveX / bgImageWidth;

    document.getElementById("tianai-slider-move-btn").style.transform = "translate(" + moveX + "px, 0px)";
    this.config[this.generateData.type].onMove.bind(this)();
  }
  sliderMove() {
    const moveX = this.validValue.moveX;
    document.getElementById("tianai-image-content-target").style.transform = "translate(" + moveX + "px, 0px)";
  }
  rotateMove() {
    const moveX = this.validValue.moveX;
    document.getElementById("image-content-target-template").style.transform = "rotate(" + (moveX / ((this.validValue.end) / 360)) + "deg)";
  }
  concatMove() {
    const moveX = this.validValue.moveX;
    document.getElementById("tianai-image-content-target").style.backgroundPositionX = moveX + "px";
  }
  up(event) {
    this.detachGlobalPointerListeners();

    let pointer = event;
    if (event && typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      pointer = event.changedTouches[0] || event.touches[0];
    } else if (event && typeof window !== "undefined" && window.PointerEvent && event instanceof PointerEvent) {
      pointer = event;
    }

    this.validValue.stopTime = new Date();

    let pageX;
    let pageY;
    if (pointer) {
      const xy = this.getPointerPageXY(pointer);
      pageX = xy.x;
      pageY = xy.y;
    } else {
      pageX = Math.round(this.validValue.startX + (this.validValue.moveX || 0));
      pageY = Math.round(this.validValue.startY);
    }

    const startX = this.validValue.startX;
    const startY = this.validValue.startY;

    const startTime = this.validValue.startTime;
    const trackArr = this.validValue.trackArr;

    const track = {
      x: pageX - startX,
      y: pageY - startY,
      type: "up",
      t: (new Date().getTime() - startTime.getTime())
    }

    trackArr.push(track);

    this.valid();
  }
  valid() {
    const data = {
      bgImageWidth: this.validValue.bgImageWidth,
      bgImageHeight: this.validValue.bgImageHeight,
      templateImageWidth: this.generateData.templateImageWidth,
      templateImageHeight: this.generateData.templateImageHeight,
      startTime: this.validValue.startTime.getTime(),//this.formatDate(this.validValue.startTime, this.config.dateFormat),
      stopTime: this.validValue.stopTime.getTime(),//this.formatDate(this.validValue.stopTime, this.config.dateFormat),
      trackList: this.validValue.trackArr
    };

    let alert = document.getElementById("tianai-content-image-wrapper-alert");
    if (alert) {
      this.fadeOut(alert);
    }

    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
      delete this.alertTimeout;
    }

    this.loading(this.config.validText);
    this
        .http
        .post("/captcha/clientVerify?" + this.config.postConfig.tokenParamName + "=" + this.config.token, data)
        .then(r=> this.showResult(r.data))
        .catch((e) => {
          if (this.config.failRefreshCaptcha) {
            this.generateCaptcha();
          }
          this.config.fail(e);
        });
  }
  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    format = format.replace('yyyy', year);
    format = format.replace('MM', month);
    format = format.replace('dd', day);
    format = format.replace('HH', hours);
    format = format.replace('mm', minutes);
    format = format.replace('ss', seconds);

    return format;
  }
  removeLoading() {
    const loading = document.getElementById("tianai-loading");
    if (loading) {
      this.fadeOut(loading);
    }
  }
  loading(text) {
    const target = document.getElementById("tianai-loading");
    if (target) {
      return ;
    }
    let content = document.getElementById("tianai-content");
    const template = `
    <div class="__tianai-content-loading" id="tianai-loading">
      <div class="__tianai-content-loading-loader"></div>
      <div class="__tianai-content-loading-text">
        ${text}
      </div>
    </div>
    `
    this.fadeIn(content.lastElementChild);
    content.insertAdjacentHTML("beforeend", template);
  }
  showResult(data) {
    //const creationTime = new Date().getTime();
    const wrapper = document.getElementById("tianai-content-image-wrapper");
    const template = `
      <div class="__tianai-content-image-wrapper-alert ${data.executeCode === '200' ? 'success' : 'error'}" id="tianai-content-image-wrapper-alert">
        ${data.message}
      </div>
    `
    wrapper.insertAdjacentHTML("beforeend", template);
    const alert = wrapper.lastElementChild;
    this.fadeIn(alert);
    this.alertTimeout = setTimeout(() => this.fadeOut(alert), 3000);
    if (data.executeCode === "200") {
      this.removeLoading();
      this.config.success(data);
    } else {
      this.config.fail(data);
      if (this.config.failRefreshCaptcha) {
        this.generateCaptcha(false);
      }
    }
  }
}

export default TianaiCaptcha
