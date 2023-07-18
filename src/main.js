const { invoke } = window.__TAURI__.tauri;
const { writeTextFile, BaseDirectory }= window.__TAURI__.fs;
const { dataDir } = window.__TAURI__.path;

let slides;
let maxSlide;
let slideIndex = 0;
let maxValue = 5;
// First number set autofills all related
let doAutoFill = true;

const slideContainer = document.getElementById('SlideContainer');
let currentGroup;

const fileNameInput = document.getElementById('SetFileName')
fileNameInput.addEventListener('input', () => {
  invoke('set_gradebook_name', {name: fileNameInput.value});
});

document.addEventListener("keyup", function(event) {
  if (event.key == 'Backspace') {
    prevSlide();
  }
  else if (event.key == 'Space') {
    event.preventDefault();
    nextSlide();
  }
  else if (doAutoFill && event.key >= '0' && event.key <= '9') {
    var num = Number(event.key)
    autoFillGrades(num);
  }
});

function autoFillGrades(grade) {
  var selectElements = document.getElementsByTagName("select");
  grade = Math.min(grade, maxValue - 1)
  for(var i = 0; i < selectElements.length; i++) {
    selectElements[i].value = grade;
    slideValueChanged({currentTarget: {value: grade}}, i);
  }
  doAutoFill = false;
}

async function _initList() {
  // Extract pokemon objects from 'related' array 
  // Pass to rust
  var total = [];
  for(var i in slides) {
    for(var j in slides[i]) {
      pokemon = slides[i][j];
      total.push(pokemon);
    }
  }
  await invoke('init_list', {list: total})
}
async function load() {
  var s = await fetch('./slides.json');
  slides = await s.json();
  maxSlide = Object.keys(slides).length;

  // console.log(slides)
  await _initList()

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
  doAutoFill = true;

  var slide = document.createElement('div');
  slide.className = 'slide';

  var img = document.createElement('img')
  img.setAttribute('src', './assets/pics/' + pokemon['dex_no'] + '.jpg')
  slide.appendChild(img)

  var opts = document.createElement('select');
  opts.setAttribute('onchange', `slideValueChanged(event, ${index})`);
  // Forward & Back button are tabindex=8 & 9
  opts.setAttribute('tabindex', Number(index) + 1)
  var opt;
  for (var i = 0; i < maxValue; i++) {
    opt = document.createElement('option');
    opt.setAttribute('value', i);
    opt.text = i;
    opts.appendChild(opt);
  }

  slide.appendChild(opts);

  if('grade' in pokemon) {
    console.log(pokemon.grade)
    opts.value = pokemon.grade;
  } 

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
  document.getElementsByTagName('select')[0].focus();
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
  pokemon.grade = value;
  invoke('set_grade', { json: pokemon, grade: value });

  document.getElementById("NextSlideButton").focus();
}

async function saveGradebook() {
  var gradebook = await invoke('get_gradebook');
  var fileName = await invoke('get_gradebook_name')
  await writeTextFile(`${fileName}`, gradebook, { dir: BaseDirectory.AppLocalData });
}