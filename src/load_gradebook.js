const { BaseDirectory } = window.__TAURI__.fs
const { readDir } = window.__TAURI__.fs
const fileListEl = document.getElementById('FileList')
const openFileButtonEl = document.getElementById('OpenFile')

openFileButtonEl.setAttribute('disabled', 'true')
let selectedFile

async function openGradingPage() {
    window.localStorage.setItem('filePath', selectedFile)
    window.location.replace('grading.html')
}

async function listCsvFiles() {
    window.localStorage.clear()

    let files = await readDir('', { dir: BaseDirectory.AppLocalData })
    let csvFiles = []
    var el
    var index = 1
    for (var file of files) {
        if (file.name.endsWith('.csv')) {
            file = file.name.replace('.csv', '')
            csvFiles.push(file)
            el = document.createElement('button')
            el.setAttribute('tabindex', index)
            el.setAttribute('onclick', 'selectFile(event)')
            index += 1
            el.textContent =  file
            fileListEl.appendChild(el)
        }
    }
}

function selectFile(event) {
    selectedFile = event.currentTarget.textContent
    openFileButtonEl.removeAttribute('disabled')
}