const { invoke } = window.__TAURI__.tauri;

let slides;
let maxSlide;
let slideIndex = 0;
let minValue = 0;
let maxValue = 5;

const slideContainer = document.getElementById('SlideContainer');
let currentGroup;

async function load() {
  var s = await fetch('./slides.json');
  slides = await s.json();
  maxSlide = Object.keys(slides).length;

  document.getElementById('start-tab').click()
  slideIndex = -1;
  nextSlide();
}

function openTab(event, id) {
  // Declare all variables
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(id).style.display = "block";
  event.currentTarget.className += " active";
}

function _createSlide(pokemon, index) {
  console.log('Opened ' + pokemon['name'] + " (" + pokemon['dex_no'] + ")")

  var slide = document.createElement('div');
  slide.className = 'slide';

  var img = document.createElement('img')
  img.setAttribute('src', './assets/pics/' + pokemon['dex_no'] + '.jpg')
  slide.appendChild(img)

  var opts = document.createElement('select');
  opts.setAttribute('onchange', `slideValueChanged(event, ${index})`);

  var opt;
  for (var i = 0; i < maxValue; i++) {
    opt = document.createElement('option');
    opt.setAttribute('value', i);
    opt.text = i;

    opts.appendChild(opt);
  }

  slide.appendChild(opts);
  return slide;
}

function nextSlide() {
  slideIndex += 1;
  if (slideIndex >= maxSlide) {
    slideIndex = 0;
  }

  // Delete old children
  slideContainer.innerHTML = '';
  currentGroup = slides[slideIndex];

  // Attach new children
  var slide;
  for (var pokemon in currentGroup) {
    slide = _createSlide(currentGroup[pokemon], pokemon);
    slideContainer.appendChild(slide);
  }
}

function prevSlide() {
  slideIndex -= 1;
  if (slideIndex < 0) {
    slideIndex = maxSlide - 1;
  }
  // Delete old children
  slideContainer.innerHTML = '';
  currentGroup = slides[slideIndex];

  // Attach new children
  var slide;
  for (var pokemon in currentGroup) {
    slide = _createSlide(currentGroup[pokemon], pokemon);
    slideContainer.appendChild(slide);
  }
}

function slideValueChanged(event, index) {
  var pokemon = slides[slideIndex][index];
  var value = Number(event.currentTarget.value);
  
  invoke('set_grade', {json: pokemon, grade: value});
}