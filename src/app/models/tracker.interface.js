"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackerFrequency = exports.TrackerType = exports.TrackerCategory = void 0;
var TrackerCategory;
(function (TrackerCategory) {
    TrackerCategory["MIND"] = "mind";
    TrackerCategory["BODY"] = "body";
    TrackerCategory["SOUL"] = "soul";
    TrackerCategory["BEAUTY"] = "beauty";
    TrackerCategory["MOOD"] = "mood";
    TrackerCategory["CUSTOM"] = "custom"; // user-defined tracker types
})(TrackerCategory || (exports.TrackerCategory = TrackerCategory = {}));
var TrackerType;
(function (TrackerType) {
    TrackerType["DURATION"] = "duration";
    TrackerType["COUNT"] = "count";
    TrackerType["RATING"] = "rating";
    TrackerType["BOOLEAN"] = "boolean";
    TrackerType["SCALE"] = "scale"; // 1-10 mood/wellness scale
})(TrackerType || (exports.TrackerType = TrackerType = {}));
var TrackerFrequency;
(function (TrackerFrequency) {
    TrackerFrequency["DAILY"] = "daily";
    TrackerFrequency["WEEKLY"] = "weekly";
    TrackerFrequency["MONTHLY"] = "monthly"; // track monthly goals
})(TrackerFrequency || (exports.TrackerFrequency = TrackerFrequency = {}));
//# sourceMappingURL=tracker.interface.js.map