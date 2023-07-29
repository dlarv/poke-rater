const { invoke } = window.__TAURI__.tauri;
const { writeTextFile, readTextFile, exists, BaseDirectory } = window.__TAURI__.fs

const generationNames = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea']
const colorValues = { 
    White: '240,240,240', 
    Black: '88,88,88', 
    Gray: '160,160,160', 
    Blue: '48,136,240', 
    Red: '240,88,104', 
    Green: '64,184,104', 
    Pink: '248, 144, 200', 
    Purple: '168, 104, 192', 
    Brown: '176,112,48' , 
    Yellow: '240,208,72' }  

const generalSlideEl = document.getElementById('Media-Tab');
const generationSlideEl = document.getElementById('Generation-Tab');
const typingSlideEl = document.getElementById('Typing-Tab');
const matchupSlideEl = document.getElementById('Matchup-Tab')
const looksSlideEl = document.getElementById("Looks-Tab")
let gradeLabels
// TODO: function used by 2 pages, write in one place and export (DRY)
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
    var grades = window.localStorage.getItem('maxGrade')
    gradeLabels = window.localStorage['gradeLabels'].split(',')
    if (!grades) {
        alert('Please load a gradebook')
        window.location.replace('index.html')
    }
    var data = await invoke('analyze', { numGrades: Number(grades)})
    saveDataToJson(data)

    renderMediaSlide(data['anime_average'], data['manga_average'])
    renderPerfectSlide(data['perfect_scores'])
    renderWorstSlide(data['worst_scores'])
    renderLooksSlide(data['color_average'])
    renderGenerationSlide(data['gen_average'])
    renderTypingSlide(data['dual_type_average'], data['single_type_average'], data['typing_average'])
    renderMatchupSlide(data['matchup_data'])
    renderStatSlide(data['stats_data'])
    document.getElementById('start-tab').click()
}

function convertNumToFloats(data) {
    // Floats to 2 decimal
    if (typeof (data) === 'number') {
        data = data.toFixed(2)
    }
    else if (typeof(data) === 'object') {
        for (var item in data) {
            data[item] = convertNumToFloats(data[item])
        }
    }
    return data
}



async function saveDataToJson(data) {
    var fileName = window.localStorage.getItem('fileName')

    for (var item in data) {
        data[item] = convertNumToFloats(data[item])
    }
    console.log(data)
    await writeTextFile(`${fileName}.json`, JSON.stringify(data), { dir: BaseDirectory.AppLocalData })
}

// Populate slides with data
function renderMediaSlide(animeCount, mangaCount) {
    // Anime / Manga: avg-#appearances / grade  
    // Color: avg-grade / color
    var tableEl = document.getElementById('Media-Table')
    // animeCount = animeCount.map((x) => {if (x === null) { return 0;} else { return Number(x)}})
    var maxAnimeVal = parseInt(Math.max(...animeCount.filter(x => x !== null)) * 100)
    var minAnimeVal = parseInt(Math.min(...animeCount.filter(x => x !== null)) * 100)
    var maxMangaVal = parseInt(Math.max(...mangaCount.filter(x => x !== null)) * 100)
    var minMangaVal = parseInt(Math.min(...mangaCount.filter(x => x !== null)) * 100)

    var rowEl
    var itemEl

    var count
    for (var i in gradeLabels) {
        rowEl = document.createElement('tr')
        itemEl = document.createElement('td')
        itemEl.textContent = gradeLabels[i]
        rowEl.appendChild(itemEl)

        itemEl = document.createElement('td')
        itemEl.textContent = animeCount[i]
        rowEl.appendChild(itemEl)
        count = parseInt(animeCount[i]*100)
        if (count == maxAnimeVal) {
            itemEl.setAttribute('style', 'color: #007f00')
        }
        if (count == minAnimeVal) {
            itemEl.setAttribute('style', 'color: #7f0000')
        }


        itemEl = document.createElement('td')
        itemEl.textContent = mangaCount[i]
        rowEl.appendChild(itemEl)

        count = parseInt(mangaCount[i] * 100)
        if (count == maxMangaVal) {
            itemEl.setAttribute('style', 'color: #007f00')
        }
        if (count == minMangaVal) {
            itemEl.setAttribute('style', 'color: #7f0000')
        }
        tableEl.appendChild(rowEl)
    }
}

function renderPerfectSlide(data) {
    if (data.length == 0) {
        var info = document.getElementById('Perfect-Tab-Info')
        info.textContent += ' ... It doesn\'t look like any Pokemon earned this grade'
        return
    }

    var columns = [
        document.getElementById('Perfect-Tab-Slide-1'),
        document.getElementById('Perfect-Tab-Slide-2'),
        document.getElementById('Perfect-Tab-Slide-3'),
        document.getElementById('Perfect-Tab-Slide-4'),
        document.getElementById('Perfect-Tab-Slide-5')
    ]

    var el
    for (var i in data) {
        el = document.createElement('span')
        el.setAttribute('class', 'analysis-container')
        el.textContent = data[i]
        columns[i % 5].appendChild(el)
    }
}

function renderWorstSlide(data) {
    if (data.length == 0) {
        var info = document.getElementById('Worst-Tab-Info')
        info.textContent += ' ... It doesn\'t look like any Pokemon earned this grade'
        return
    }
    var columns = [
        document.getElementById('Worst-Tab-Slide-1'),
        document.getElementById('Worst-Tab-Slide-2'),
        document.getElementById('Worst-Tab-Slide-3'),
        document.getElementById('Worst-Tab-Slide-4'),
        document.getElementById('Worst-Tab-Slide-5')
    ]

    var el
    for (var i in data) {
        el = document.createElement('span')
        el.setAttribute('class', 'analysis-container')
        el.textContent = data[i]
        columns[i % 5].appendChild(el)
    }
}

function renderLooksSlide(data) {
    looksSlideEl.textContent = ''
    var title = document.createElement('h2')
    title.textContent = 'Aesthetics'
    looksSlideEl.appendChild(title)

    var el
    var headerEl
    var colorName
    var bodyEl
    for (var i in data) {
        colorName = data[i][0]

        el = document.createElement('span')
        el.setAttribute('class', 'analysis-container')

        headerEl = document.createElement('h3')
        headerEl.textContent = `#${Number(i) + 1}`
        el.appendChild(headerEl)
        
        bodyEl = document.createElement('span')
        bodyEl.setAttribute('class', 'analysis-body')
        bodyEl.textContent = colorName;
        el.appendChild(bodyEl)
        
        el.setAttribute('style', `background-color: rgba(${colorValues[colorName]},.5);`)
        // Set bg transparent
        headerEl.setAttribute('style', 'background-color: #fff0;')
        bodyEl.setAttribute('style', 'background-color: #fff0;')

        looksSlideEl.appendChild(el)
    }
}

function renderGenerationSlide(data) {
    generationSlideEl.textContent = ''
    var title = document.createElement('h2')
    title.textContent = 'Generation'
    generationSlideEl.appendChild(title)

    var el
    var headerEl
    var gen
    var bodyEl
    for (var i in data) {
        el = document.createElement('span')
        el.setAttribute('class', 'analysis-container')
        headerEl = document.createElement('h3')
        headerEl.textContent = `#${Number(i) + 1}`
        el.appendChild(headerEl)
        
        gen = data.reduce((max, val) => Math.max(Number(max), Number(val)), 0)
        gen = data.findIndex((val) => Number(val) == Number(gen))
        data[gen] = 0

        bodyEl = document.createElement('span')
        bodyEl.setAttribute('class', 'analysis-body')
        bodyEl.textContent = `Generation ${gen + 1}`; 
        bodyEl.textContent += ` (${generationNames[gen]})`
        el.appendChild(bodyEl)

        generationSlideEl.appendChild(el)
    }
}

function renderTypingSlide(dualTypes, singleTypes, typeAverages) {
    var numTypesEl = document.getElementById('Num-Types')
    dualTypes = Number(dualTypes)
    singleTypes = Number(singleTypes)

    var text = 'You prefer '
    if (dualTypes > singleTypes) {
        text += 'dual-types over single-types: ' + (dualTypes / singleTypes).toFixed(2)
    } else {
        text += 'single-types over dual-types ' + (singleTypes / dualTypes).toFixed(2)
    }
    numTypesEl.textContent = text
    
    var columns = [
        document.getElementById('Typing-Tab-Slide-1'),
        document.getElementById('Typing-Tab-Slide-2'),
        document.getElementById('Typing-Tab-Slide-3')
    ]

    var typeName
    var headerEl
    var colIndex
    for (var i in typeAverages) {
        el = document.createElement('span')
        el.setAttribute('class', 'analysis-container')
        headerEl = document.createElement('h3')
        headerEl.textContent = `#${Number(i) + 1}`
        el.appendChild(headerEl)
        
        typeName = typeAverages[i][0]

        bodyEl = document.createElement('span')
        bodyEl.setAttribute('class', 'analysis-body')
        bodyEl.textContent = `${typeName}`

        el.appendChild(bodyEl)

        colIndex = parseInt(Number(i) / 6); 
        columns[colIndex].appendChild(el)
    }

}
function buildTable(tableEl, data, invertColors=false) {
    // Color max and min value for each column
    var minColor
    var maxColor
    if (!invertColors) {
        minColor = '#7f0000'
        maxColor = '#007f00'
    }
    else {
        
        maxColor = '#7f0000'
        minColor = '#007f00'
    }

    var numColumns = Object.keys(data[0]).length
    var columnMaxValues = Array.from('0'.repeat(numColumns))
    var columnMinValues = Array.apply(null, Array(numColumns)).map(function () { return Infinity; })
    var index = 0
    for (var grade in data) {
        index = 0
        for (var column in data[grade]) {
            columnMaxValues[index] = Math.max(columnMaxValues[index], data[grade][column])
            columnMinValues[index] = Math.min(columnMinValues[index], data[grade][column])
            index += 1
        }
    }

    var row
    var cell
    var value
    var left
    var right
    for (var grade in data) {
        row = document.createElement('tr')
        tableEl.appendChild(row)

        // Grade column
        cell = document.createElement('td')
        cell.textContent = Number(grade) + 1
        row.appendChild(cell)
        index = 0
        for (var column in data[grade]) {
            value = parseFloat(data[grade][column])
            cell = document.createElement('td')
            cell.textContent = value
            row.appendChild(cell)

            left = parseInt(value * 100)
            right = parseInt(columnMaxValues[index] * 100)
            if (left === right) {
                cell.setAttribute('style', `color: ${maxColor};`)
            }
            right = parseInt(columnMinValues[index] * 100)
            if (left === right) {
                cell.setAttribute('style', `color: ${minColor};`)
            }
            index += 1
        }
    }


}
function renderMatchupSlide(data) {
    var titleRowEl = document.getElementById("Matchup-Tab-Header-Row")
    var tableBody = document.getElementById("Matchup-Table")
    var cell

    // Build header
    for (var type of Object.keys(data[0])) {
        cell = document.createElement('th')
        cell.textContent = type
        titleRowEl.appendChild(cell)
    }
    tableBody.appendChild(titleRowEl)
    
    buildTable(tableBody, data, true)

    // var row
    // for (var grade in data) {
    //     row = document.createElement('tr')
    //     tableBody.appendChild(row)

    //     // Grade column
    //     cell = document.createElement('td')
    //     cell.textContent = Number(grade) + 1
    //     row.appendChild(cell)

    //     for (var matchup in data[grade]) {
    //         cell = document.createElement('td')
    //         cell.textContent = data[grade][matchup]
    //         row.appendChild(cell)
    //     }
    // }
}

function renderStatSlide(data) {
    var titleRowEl = document.getElementById("Stat-Tab-Header-Row")
    var tableBody = document.getElementById("Stat-Table")
    var cell

    // Build header
    for (var type of Object.keys(data[0])) {
        cell = document.createElement('th')
        cell.textContent = type
        titleRowEl.appendChild(cell)
    }
    tableBody.appendChild(titleRowEl)

    buildTable(tableBody, data)
    // var row
    // for (var grade in data) {
    //     row = document.createElement('tr')
    //     tableBody.appendChild(row)

    //     // Grade column
    //     cell = document.createElement('td')
    //     cell.textContent = Number(grade) + 1
    //     row.appendChild(cell)

    //     for (var matchup in data[grade]) {
    //         cell = document.createElement('td')
    //         cell.textContent = data[grade][matchup]
    //         row.appendChild(cell)
    //     }
    // }
}