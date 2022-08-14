function getAssign(){
    var dat = new Date()
    var footer = document.getElementById('footer')
    footer.innerHTML = `${dat.getFullYear()} - Jonathan Duclos`
    return (`${dat.getFullYear()} - Jonathan Duclos`)
}