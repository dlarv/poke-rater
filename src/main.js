const { invoke } = window.__TAURI__.tauri;
const { writeTextFile, BaseDirectory }= window.__TAURI__.fs;
const { dataDir } = window.__TAURI__.path;

let slides;
let maxSlide;
let slideIndex = 0;
const maxValue = 5;
let allValues = [ 0, 1, 2, 3, 4 ]
const maxGen = 9;
// First number set autofills all related
let doAutoFill = true;
let allTypes;

const slideContainer = document.getElementById('SlideContainer');
let currentGroup;

const fileNameInput = document.getElementById('SetFileName')
fileNameInput.addEventListener('input', () => {
  invoke('set_gradebook_name', {name: fileNameInput.value});
});

document.getElementById("Slide-Mode").addEventListener("keyup", function(event) {
  if(slideContainer.style.display == 'hidden') {
    return;
  }
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

const autoFillContainer = document.getElementById("AutoFill-RulesContainer")
const autoFillAddNew = document.getElementById("AutoFill-AddNew")
const autoFillRulesList = document.getElementById("AutoFill-List")
let autoFillRules = []

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

function autoFillGrades(grade) {
  var selectElements = document.getElementsByTagName("select");
  grade = Math.min(grade, maxValue - 1)
  for(var i = 0; i < selectElements.length; i++) {
    selectElements[i].value = grade;
    slideValueChanged({currentTarget: {value: grade}}, i);
  }
  doAutoFill = false;
}

function autoFillRuleSelected(obj, id) {
  var valueContainer = document.getElementById(id);
  var opt;
  valueContainer.innerHTML = "";
  if (obj.value == 'gen') {
    for (var i = 1; i <= maxGen; i++) {
      opt = document.createElement('option');
      opt.text = "Generation " + i;
      opt.setAttribute('value', opt.text);
      valueContainer.appendChild(opt);
    }
  }
  else if (obj.value == 'type') {
    for (var i = 0; i < allTypes.length; i++) {
      opt = document.createElement('option')
      opt.text = allTypes[i];
      opt.setAttribute('value', opt.text + " Type");
      valueContainer.appendChild(opt);
    }
  }
}

function addAutoFillRule(rule1, rule2, val1, val2, useRule2, grade, priority) {
  if (!val1 && !val2) {
    return;
  }
  var ruleContainer = document.createElement('span');
  var rule = {
    type_rule1: null,
    type_rule2: null,
    gen_rule1: null,
    gen_rule2: null,
    grade: Number(grade),
    priority: Number(priority)
  };
  console.log(useRule2);
  if(val1) {
    ruleContainer.textContent += val1;
    if (rule1 == 'type') {
      rule.type_rule1 = val1.replace(' Type', '')
    } else if (rule1 == 'gen') {
      rule.gen_rule1 = Number(val1.replace('Generation ', ''));
    }
  } 
  if (useRule2 && val1 && val2) {
    ruleContainer.textContent += " && "
  }
  if ((useRule2 || !val1) && val2) {
    ruleContainer.textContent += val2;
    
    if (rule2 == 'type') {
      var val = val2.replace(' Type', '')
      console.log(val)
      rule.type_rule2 = val
    } else if (rule2 == 'gen') {
      rule.gen_rule2 = Number(val2.replace('Generation ', ''));
    }

  }
  ruleContainer.textContent += ` = Grade: ${grade} | Priority: ${priority}`;

  autoFillRules.push(rule);
  autoFillRulesList.appendChild(ruleContainer);
}

async function applyAutoFillRules() {
  // Sort in ascending order based on priority
  autoFillRules.sort((a, b) => Number(a.priority) - Number(b.priority));
  slides = await invoke('autofill', { slides: slides, rules: autoFillRules});
  // Apply new grades to current slide
  slideIndex -= 1;
  nextSlide();
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

  var autoFillGrades = document.getElementById("AutoFill-Grade")
  var opt;
  for(var i = 0; i < maxValue; i++) {
    opt = document.createElement('option')
    opt.setAttribute('value', i);
    opt.textContent = allValues[i];
    autoFillGrades.appendChild(opt);
  }

  allTypes = await invoke('get_all_types')

  // console.log(slides)
  // await _initList()

  document.getElementById('start-tab').click()
  slideIndex = -1;
  nextSlide();
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
    opt.text = allValues[i];
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