const capitalize = text => {
    return text.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}
give(capitalize)