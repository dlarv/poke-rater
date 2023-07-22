const presetSelectorEl = document.getElementById('PresetSelector')
const maxGradeEl = document.getElementById('MaxGradeValue')
const gradeLabelListEl = document.getElementById('GradeLabelList')
const fileNameEl = document.getElementById('FileName')

let maxGrade = maxGradeEl.value
let gradeLabels = []

presetSelectorEl.addEventListener('change', (event) => {
    var preset = event.currentTarget.value
    gradeLabelListEl.innerHTML = ''
    gradeLabels = []

    if (preset == 'tierlist') {
        maxGradeEl.value = 6
         ['F', 'D', 'C', 'B', 'A', 'S'].forEach(label => {
            addGradeLabel(label)
        })
    }
    else if (preset == '5') {
        maxGradeEl.value = 5
        for (var label of Array(5).keys()) {
            addGradeLabel(label + 1)
        }
    }
    else if (preset == '10') {
        maxGradeEl.value = 10
        for (var label of Array(10).keys()) {
            addGradeLabel(label + 1)
        }
    }
    else if (preset == 'vibes') {
        maxGradeEl.value = 6
        addGradeLabel('Ew')
        addGradeLabel('Meh')
        addGradeLabel('Has some appeal')
        addGradeLabel('I could see it on my team')
        addGradeLabel('I want it on my team')
        addGradeLabel('Absolute favorite')
    }
    maxGrade = maxGradeEl.value
})

maxGradeEl.addEventListener('change', (event) => {
    var numLabels = gradeLabelListEl.childElementCount
    var newMaxNum = event.currentTarget.value

    if (newMaxNum > numLabels) {
        while (newMaxNum > numLabels) {
            addGradeLabel(numLabels + 1)
            numLabels += 1
        }
    }
    else if (newMaxNum < numLabels) {
        while (newMaxNum < numLabels) {
            gradeLabelListEl.lastChild.remove()
            numLabels -= 1
        }
    }
    maxGrade = newMaxNum
})

function init() {
    fileNameEl.value = 'default'
    maxGradeEl.value = 5
    window.localStorage.removeItem('gradeLabels')

    for (var label of Array(5).keys()) {
        addGradeLabel(label + 1)
    }
}

function removeGradeLabel(labelEl) {
    var parent = labelEl.parentNode
    var index = Array.from(parent.parentNode.children).indexOf(parent)

    gradeLabels.splice(index, 1)

    labelEl.parentNode.remove()
    maxGrade -= 1
} 

function addGradeLabel(label) {
    var el = document.createElement('span')
    var inputEl = document.createElement('input')
    inputEl.setAttribute('value', label)

    el.appendChild(inputEl)

    var delEl = document.createElement('button')
    delEl.setAttribute('onclick', `removeGradeLabel(this)`)
    delEl.textContent = 'Delete'
    // used to find button even if text has been modified
    // delEl.setAttribute('')
    el.appendChild(delEl)

    gradeLabelListEl.appendChild(el)
    gradeLabels.push(label)
}

async function openGradingPage() {
    var gradeLabels = []
    for (var label of gradeLabelListEl.children) {
        gradeLabels.push(label.firstChild.value)
    }
    window.localStorage.setItem('fileName', fileNameEl.value)
    window.localStorage.setItem('gradeLabels', gradeLabels.toString())

    window.location.replace('grading.html')
}