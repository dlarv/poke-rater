const { invoke } = window.__TAURI__.tauri
const { writeTextFile, readTextFile, exists, BaseDirectory }= window.__TAURI__.fs
const { dataDir } = window.__TAURI__.path

const maxGen = 9
const slideContainerEl = document.getElementById('SlideContainer')
const fileNameInputEl = document.getElementById('SetFileName')
const autoFillRulesListEl = document.getElementById('AutoFill-List')
const nextSlideButtonEl = document.getElementById('NextSlideButton')
const gradeLabelsDisplayEl = document.getElementById('GradeLabelDisplay')
// Elements/Listeners
/*
 Options:
 1. Don't let user rename file
 2. Add a button next to input element
  - Function called when its clicked
  - Function called when open button inside create-gradebook.html is clicked 
*/
let fileName = fileNameInputEl.value
async function setFileName(name) {
  if (await exists(`${name}.csv`, { dir: BaseDirectory.AppLocalData })) {
    var doOverwrite = await confirm(`'${name}.csv' already exists. Would you like to overwrite it?`)

    if (!doOverwrite) {
      name = fileName
    } 
  }
  fileName = name
  fileNameInputEl.value = name
}
fileNameInputEl.addEventListener('input', () => {
  fileName = fileNameInputEl.value
})

document.addEventListener('keydown', function (event) {
  if (slideContainerEl.style.display == 'hidden') {
    return
  }
  if (event.key == 'ArrowLeft') {
    event.preventDefault()
    prevSlide()
  }
  else if (event.key == ' ' || event.key == 'ArrowRight') {
    event.preventDefault()
    nextSlide()
  }
  else if (doAutoFill && event.key >= '0' && event.key <= '9') {
    var num = Number(event.key)
    // Grades arent typically 0-index
    autoFillGrades(num)
  } 
  else if (event.key == 'Enter') {
    if (document.activeElement !== nextSlideButtonEl) {
      event.preventDefault()
      nextSlideButtonEl.focus()
    }
  }
  else if (event.key == 'Tab') {
    doAutoFill = false
  }
  else if (event.key == '.') {
    doAutoFill = !doAutoFill
  }
})

// Init vars
let autoFillRules = []
let slides
let grades
let maxSlide
let slideIndex = -1
let currentPokemonGroup

let maxGrade = 5
let gradeLabels = [ 1, 2, 3, 4, 5 ]
let typesList
let showGradeLabelDisplay = true

// First number entered is applied to other related
let doAutoFill = true

// Called by grading.html
function openTab(event, id) {
  // Declare all variables
  var i, tabcontent, tablinks

  // Get all elements with class='tabcontent' and hide them
  tabcontent = document.getElementsByClassName('tabcontent')
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = 'none'
  }

  // Get all elements with class='tablinks' and remove the class 'active'
  tablinks = document.getElementsByClassName('tablinks')
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(' active', '')
  }

  // Show the current tab, and add an 'active' class to the button that opened the tab
  document.getElementById(id).style.display = 'block'
  event.currentTarget.className += ' active'
}

async function load() {
  var data = await fetch('./slides.json')
    .then(data => data.json())

  // data = await data.json()
  slides = await invoke('init_list', { slides: data })
  init()
}

async function init() {
  maxSlide = Object.keys(slides).length

  // Local data
  var filePathSaved = window.localStorage.getItem('filePath')
  if (filePathSaved) {
    await read(filePathSaved)
  }
  var fileNameSaved = window.localStorage.getItem('fileName')
  if (fileNameSaved) {
    // setFileName(fileNameSaved)
    fileNameInputEl.value = fileNameSaved
    fileName = fileNameSaved
  }
  var gradeLabelSaved = window.localStorage.getItem('gradeLabels')
  if (gradeLabelSaved) {
    gradeLabels = gradeLabelSaved.split(',')
    maxGrade = gradeLabels.length
  }
  renderGradeLabelsDisplay()

  // Autofill screen
  var autoFillGradesEl = document.getElementById('AutoFill-Grade')
  autoFillGradesEl.innerHTML = ''
  var opt
  for (var i = 0; i < maxGrade; i++) {
    opt = document.createElement('option')
    opt.setAttribute('value', i)
    opt.textContent = gradeLabels[i]
    autoFillGradesEl.appendChild(opt)
  }

  typesList = await invoke('list_ptypes')

  document.getElementById('start-tab').click()
  nextSlide()
}
// Get csv of grades in dex order
async function read(fileName) {
  console.log(`Reading ${fileName}.csv`)
  
  var contents = await readTextFile(`${fileName}.csv`, { dir: BaseDirectory.AppLocalData }).then((text) => text)
  contents = contents.split('\n')

  window.localStorage.setItem('fileName', fileName)
  window.localStorage.removeItem('filePath')
  
  var gradeCsv
  if (contents.length == 1) {
    gradeCsv = contents[0]
  }
  else {
    gradeLabels = contents[0].split(',')
    window.localStorage.setItem('gradeLabels', gradeLabels.toString())
    gradeCsv = contents.slice(1).toString()
  }
  var startSlide = await invoke('parse_csv_file', { csv: gradeCsv })
  for (var i in slides) {
    
    if (slides[i].includes(startSlide)) {
      slideIndex = i - 1
      break
    }
  }

}

// Draw grade labels for non-numeric grades
function renderGradeLabelsDisplay() {
  var isDigit = gradeLabels.find((value) => value.match(/^[0-9]+$/) == null)
  if (!showGradeLabelDisplay || !isDigit) { 
    return
  }

  var display
  for (var label in gradeLabels) {
    display = document.createElement('p')
    display.textContent = `${label}:  ${gradeLabels[label]}`
    gradeLabelsDisplayEl.appendChild(display)
  }

}

// Apply grade to all related pokemon
function autoFillGrades(grade) {
  var selectElements = slideContainerEl.getElementsByTagName('select')
  grade = Math.min(grade, maxGrade)
  for (var i = 0; i < selectElements.length; i++) {
    selectElements[i].value = grade
    setGrade({currentTarget: {value: grade}}, i)
  }
  doAutoFill = false
  nextSlideButtonEl.focus()
}

// Append <option> elements to autofill <select>
function autoFillRuleSelected(obj, id) {
  var valueContainerEl = document.getElementById(id)
  var opt
  valueContainerEl.innerHTML = ''
  if (obj.value == 'gen') {
    for (var i = 1; i <= maxGen; i++) {
      opt = document.createElement('option')
      opt.text = 'Generation ' + i
      opt.setAttribute('value', opt.text)
      valueContainerEl.appendChild(opt)
    }
  }
  else if (obj.value == 'type') {
    for (var i = 0; i < typesList.length; i++) {
      opt = document.createElement('option')
      opt.text = typesList[i]
      opt.setAttribute('value', opt.text + ' Type')
      valueContainerEl.appendChild(opt)
    }
  }
}

// Create new autofill rule element
function addAutoFillRule(rule1, rule2, val1, val2, useRule2, grade, priority) {
  if (!val1 && !val2) {
    return
  }
  var ruleContainer = document.createElement('span')
  var rule = {
    type_rule1: null,
    type_rule2: null,
    gen_rule1: null,
    gen_rule2: null,
    grade: Number(grade),
    priority: Number(priority)
  }

  if (val1) {
    ruleContainer.textContent += val1
    if (rule1 == 'type') {
      rule.type_rule1 = val1.replace(' Type', '')
    } else if (rule1 == 'gen') {
      rule.gen_rule1 = Number(val1.replace('Generation ', ''))
    }
  } 
  if (useRule2 && val1 && val2) {
    ruleContainer.textContent += ' && '
  }
  if ((useRule2 || !val1) && val2) {
    ruleContainer.textContent += val1
    
    if (rule2 == 'type') {
      var val = val2.replace(' Type', '')
      rule.type_rule2 = val
    } else if (rule2 == 'gen') {
      rule.gen_rule2 = Number(val2.replace('Generation ', ''))
    }

  }
  ruleContainer.textContent += ` = Grade: ${gradeLabels[rule.grade]} | Priority: ${rule.priority}`
  var deleteButtonEl = document.createElement('button')
  deleteButtonEl.setAttribute('onclick', 'removeAutoFillRule(this)')
  deleteButtonEl.textContent = 'Delete'
  ruleContainer.appendChild(deleteButtonEl)

  ruleContainer.setAttribute('class', 'autofill-rule')
  autoFillRules.push(rule)
  autoFillRulesListEl.appendChild(ruleContainer)
  console.log(autoFillRules)
}

async function removeAutoFillRule(el) {
  var parent = el.parentNode
  var index = Array.from(parent.parentNode.children).indexOf(parent)

  autoFillRules.splice(index, 1)

  el.parentNode.remove()
}

// Apply rules to pokemon list
async function applyAutoFillRules() {
  // Sort in ascending order based on priority
  autoFillRules.sort((a, b) => Number(a.priority) - Number(b.priority))

  await invoke('autofill', { rules: autoFillRules })
  alert('Applied autofill rules')

  // Apply new grades to current slide (reload slide)
  slideIndex -= 1
  nextSlide()

}

// Create element holding pokemon
function _addPokemonToSlide(pokemon, index) {
  console.log('Opened ' + pokemon['name'] + ' (' + pokemon['dex_no'] + ')')
  doAutoFill = true

  var slide = document.createElement('div')
  slide.className = 'slide'

  var img = document.createElement('img')
  img.setAttribute('src', './assets/pics/' + pokemon['dex_no'] + '.jpg')
  slide.appendChild(img)

  var opts = document.createElement('select')
  //!! First pokemon grade is set twice
  opts.setAttribute('onchange', `setGrade(event, ${index})`)
  // Forward & Back button are tabindex=2 & 1
  opts.setAttribute('tabindex', Number(index) + 3)


  var opt
  for (var i = 0; i < maxGrade; i++) {
    opt = document.createElement('option')
    // Grades aren't 0-index
    opt.setAttribute('value', i + 1)
    opt.text = gradeLabels[i]
    opts.appendChild(opt)
  }

  slide.appendChild(opts)

  if ('grade' in pokemon) {
    opts.value = pokemon.grade
  } 
  opts.addEventListener('keyup', function (event) {
    if (!doAutoFill && event.key >= '0' && event.key <= '9') {
      var grade = Number(event.key)
      grade = Math.min(grade, maxGrade)
      this.value = grade
      setGrade({ currentTarget: { value: grade } }, index)
    }
  })
  return slide
}

async function nextSlide() {
  slideIndex = Number(slideIndex)+ 1

  if (slideIndex >= maxSlide) {
    slideIndex = 0
  }
  // Delete old children
  slideContainerEl.innerHTML = ''
  currentPokemonGroup = slides[slideIndex]

  // Attach new children
  var slide
  var pokemon
  for (var index in currentPokemonGroup) {

    pokemon = await invoke('get_pokemon_at', {dexNo: Number(currentPokemonGroup[index])})
    slide = _addPokemonToSlide(pokemon, index)
    slideContainerEl.appendChild(slide)
  }
  document.getElementsByTagName('select')[0].focus()
  writeToFs()
}

async function prevSlide() {
  slideIndex -= 1
  if (slideIndex < 0) {
    slideIndex = maxSlide - 1
  }
  // Delete old children
  slideContainerEl.innerHTML = ''
  currentPokemonGroup = slides[slideIndex]


  // Attach new children
  var slide
  var pokemon
  for (var index in currentPokemonGroup) {

    pokemon = await invoke('get_pokemon_at', { dexNo: Number(currentPokemonGroup[index]) })
    slide = _addPokemonToSlide(pokemon, index)
    slideContainerEl.appendChild(slide)
  }
  document.getElementsByTagName('select')[0].focus()
}

// Apply grade to pokemon
async function setGrade(event, index) {
  var num = Number(currentPokemonGroup[index])
  var value = Number(event.currentTarget.value)
  console.log('Set ' + num + ' to ' + value)
  await invoke('set_grade', { dexNo: num, grade: value })
}

function startAnalysis() {
  window.localStorage.setItem('maxGrade', maxGrade)
  window.location.replace('analysis.html')

}

// Called by button, gives alert to notify user of successful save
async function saveGradebook() {
  await writeToFs()
  alert('Saved gradebook')
}

async function writeToFs() {
  var gradebook = await invoke('get_gradebook_csv', { slideIndex: currentPokemonGroup[0] })
  var labels = gradeLabels.toString()

  await writeTextFile(`${fileName}.csv`, `${labels}\n${gradebook}`, { dir: BaseDirectory.AppLocalData })
  console.log(`Saved '${fileName}'`)
}