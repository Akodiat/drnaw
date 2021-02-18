let getSignedAngle = function(v1, v2, axis) {
    v1.normalize();
    v2.normalize();
    axis.normalize();
    let s = v1.clone().cross(v2);
    let c = v1.clone().dot(v2);
    let a = Math.atan2(s.length(), c);
    if (!s.equals(axis)) {
        a *= -1;
    }
    return a;
}
export {getSignedAngle}