const DEFAULT_RECOMMENDATION_COUNT = 24;
const DEFAULT_BATCH_SIZE = 6;
const GENERIC_CATEGORIES = new Set(['casual']);
const QUICK_PLAY_CATEGORIES = new Set(['sport', 'shooter', 'driver', 'casual', 'flash']);
const DEEP_PLAY_CATEGORIES = new Set(['story', 'idle', 'sandbox', 'horror', 'puzzle', 'multiplayer']);
const CATEGORY_ALIASES = { sports: 'sport' };
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'your', 'game', 'games', 'lite', 'remastered', 'remake', 'replica', 'clone', 'pack']);
const SEQUEL_TOKENS = new Set(['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'winter', 'spooky', 'pool', 'remake', 'remastered', 'replica', 'clone', 'lite']);
const POPULAR_GAME_PRIORS = {
    slope: 1,
    'tunnel rush': 0.95,
    minecraft: 0.95,
    superhot: 0.92,
    bitlife: 0.9,
    'cookie clicker': 0.9,
    'drive mad': 0.88,
    'drift hunters': 0.87,
    'geometry dash lite': 0.86,
    'time shooter 2': 0.84,
    motox3m: 0.84,
    'motox3m 2': 0.82,
    'basket bros': 0.8,
    'basketball stars': 0.8,
    'snow rider 3d': 0.78,
    '1v1 lol': 0.76,
    fnaf: 0.76,
    'fnaf 2': 0.75
};
const GAME_STATUS_DETAILS = {
    bugged: {
        label: 'Bugged',
        message: 'This game may have loading or gameplay issues.'
    },
    broken: {
        label: 'Broken',
        message: 'This game is currently not working correctly.'
    },
    maintenance: {
        label: 'Fixing',
        message: 'This game is being worked on and may change soon.'
    }
};
const GAME_STATUS_ALIASES = {
    issue: 'bugged',
    issues: 'bugged',
    buggy: 'bugged',
    unstable: 'bugged',
    down: 'broken',
    disabled: 'broken',
    unavailable: 'broken',
    wip: 'maintenance',
    repair: 'maintenance'
};

let gamesData = {};
let recommender;
let currentRecommendations = [];
let loadedCount = 0;
let userActivity = [];
let scrollListenerAttached = false;
const batchSize = DEFAULT_BATCH_SIZE;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function isEnabledFlag(value) {
    if (value === true || value === 1) return true;
    if (typeof value === 'string') return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
    return false;
}

function normalizeGameStatusKey(game) {
    if (!game) return '';
    const rawStatus = String(game.status || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    const normalizedStatus = GAME_STATUS_ALIASES[rawStatus] || rawStatus;
    if (normalizedStatus && normalizedStatus !== 'ok' && normalizedStatus !== 'working' && GAME_STATUS_DETAILS[normalizedStatus]) return normalizedStatus;
    if (isEnabledFlag(game.gameisbroken) || isEnabledFlag(game.isBroken)) return 'broken';
    if (isEnabledFlag(game.gameisbugged) || isEnabledFlag(game.isBugged)) return 'bugged';
    if (isEnabledFlag(game.maintenance)) return 'maintenance';
    return '';
}

function getGameStatus(game) {
    const statusKey = normalizeGameStatusKey(game);
    const statusDetails = GAME_STATUS_DETAILS[statusKey];
    if (!statusDetails) return null;
    return {
        key: statusKey,
        label: game.statusLabel || statusDetails.label,
        message: game.statusMessage || game.brokenMessage || statusDetails.message,
        updated: game.statusUpdated || ''
    };
}

function createGameStatusBadge(status) {
    if (!status) return null;
    const badge = document.createElement('span');
    const message = status.updated ? `${status.message} Updated ${status.updated}.` : status.message;
    badge.className = `game-status-badge game-status-badge--${status.key}`;
    badge.title = message;
    badge.setAttribute('aria-label', `${status.label}: ${message}`);

    const marker = document.createElement('span');
    marker.className = 'game-status-badge-mark';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = '!';
    badge.appendChild(marker);

    const label = document.createElement('span');
    label.className = 'game-status-badge-label';
    label.textContent = status.label;
    badge.appendChild(label);

    return badge;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
}

function domReady() {
    if (document.readyState === 'loading') {
        return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    return Promise.resolve();
}

class GameRecommendationEngine {
    constructor(games, options = {}) {
        this.games = games || {};
        this.keys = Object.keys(this.games);
        this.options = { recencyHalfLifeDays: 21, anchorCount: 5, graphNeighborCount: 10, graphPasses: 2, ...options };
        this.catalog = {};
        this.entries = [];
        this.categoryImportance = {};
        this.tokenImportance = {};
        this.relatedCategories = {};
        this.graph = {};
        this.graphCentrality = {};
        this.buildCatalog();
        this.buildFeatureRelations();
        this.buildGraph();
    }

    normalizeText(value) {
        return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
    }

    normalizeKey(key) {
        return this.normalizeText(key);
    }

    parseCategories(categoryString) {
        return Array.from(new Set(String(categoryString || '').split(/\s+/).map((category) => CATEGORY_ALIASES[this.normalizeText(category)] || this.normalizeText(category)).filter(Boolean)));
    }

    extractTokens(value) {
        return Array.from(new Set(this.normalizeText(value).split(' ').filter((token) => token && token.length > 1 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))));
    }

    detectSeries(entry, prefixCounts, tokenPrefixCounts) {
        const combined = `${entry.key} ${entry.normalizedName}`;
        if (/(^|\s)fnaf(\s|$)|five nights/.test(combined)) return 'fnaf';
        if (/motox3m|moto x3m/.test(combined)) return 'motox3m';
        if (/madalin/.test(combined)) return 'madalin-stunt-cars';
        if (/riddle/.test(combined)) return 'riddle';
        if (/bloons tower defence/.test(combined)) return 'bloons-tower-defence';
        if (/duck life/.test(combined)) return 'duck-life';
        if (/breaking the bank|escaping the prison|stealing the diamond|infiltrating the airship|fleeing the complex/.test(combined)) return 'henry-stickmin';

        const cleaned = entry.seriesTokens.filter((token) => !SEQUEL_TOKENS.has(token) && !/^\d+$/.test(token));
        const twoTokenPrefix = cleaned.slice(0, 2).join(' ');
        if (twoTokenPrefix && prefixCounts[twoTokenPrefix] > 1) return twoTokenPrefix;
        const oneTokenPrefix = cleaned[0];
        if (oneTokenPrefix && tokenPrefixCounts[oneTokenPrefix] > 2 && !STOP_WORDS.has(oneTokenPrefix)) return oneTokenPrefix;
        return null;
    }

    buildCatalog() {
        const base = this.keys.map((key) => ({
            key: this.normalizeKey(key),
            game: this.games[key],
            name: String(this.games[key]?.name || key),
            normalizedName: this.normalizeText(this.games[key]?.name || key),
            categories: this.parseCategories(this.games[key]?.catagory),
            tokens: this.extractTokens(`${key} ${this.games[key]?.name || key}`),
            seriesTokens: this.normalizeText(this.games[key]?.name || key).split(' ').filter(Boolean),
            type: this.games[key]?.type || 'html',
            gradient: this.games[key]?.gradient || 'none'
        }));

        const categoryCounts = {};
        const tokenCounts = {};
        const prefixCounts = {};
        const tokenPrefixCounts = {};
        base.forEach((entry) => {
            new Set(entry.categories).forEach((category) => { categoryCounts[category] = (categoryCounts[category] || 0) + 1; });
            new Set(entry.tokens).forEach((token) => { tokenCounts[token] = (tokenCounts[token] || 0) + 1; });
            const cleaned = entry.seriesTokens.filter((token) => !SEQUEL_TOKENS.has(token));
            const prefixes = [cleaned.slice(0, 2).join(' '), cleaned.slice(0, 1).join(' ')].filter(Boolean);
            prefixes.forEach((prefix) => { prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1; });
            cleaned.forEach((token) => { tokenPrefixCounts[token] = (tokenPrefixCounts[token] || 0) + 1; });
        });

        Object.keys(categoryCounts).forEach((category) => {
            if (GENERIC_CATEGORIES.has(category)) {
                this.categoryImportance[category] = 0.08;
            } else {
                const specificity = 1 - ((categoryCounts[category] - 1) / Math.max(base.length - 1, 1));
                this.categoryImportance[category] = clamp(0.35 + (specificity * 1.15), 0.12, 1.6);
            }
        });

        Object.keys(tokenCounts).forEach((token) => {
            const specificity = 1 - ((tokenCounts[token] - 1) / Math.max(base.length - 1, 1));
            this.tokenImportance[token] = clamp(0.28 + (specificity * 1.1), 0.1, 1.4);
        });

        this.entries = base.map((entry) => {
            const series = this.detectSeries(entry, prefixCounts, tokenPrefixCounts);
            const nonGenericCategories = entry.categories.filter((category) => !GENERIC_CATEGORIES.has(category));
            const featureRichness = clamp((nonGenericCategories.length * 0.22) + (entry.tokens.length * 0.03) + (series ? 0.14 : 0) + (entry.type === 'html' ? 0.08 : 0.03), 0.1, 1);
            const popularityPrior = clamp((POPULAR_GAME_PRIORS[entry.key] || 0.3) + Math.min(0.16, nonGenericCategories.length * 0.06) + Math.min(0.08, entry.tokens.length * 0.01) + (entry.type === 'html' ? 0.08 : 0.04) + (featureRichness * 0.1), 0.12, 1);
            const discoveryValue = clamp(((nonGenericCategories.reduce((sum, category) => sum + (this.categoryImportance[category] || 0.1), 0) / Math.max(nonGenericCategories.length || 1, 1)) * 0.45) + ((1 - popularityPrior) * 0.28) + (series ? 0.08 : 0) + (entry.type === 'flash' ? 0.12 : 0.06), 0.08, 1);
            const tieBreaker = Math.abs(entry.key.split('').reduce((hash, char) => (((hash << 5) - hash) + char.charCodeAt(0)) | 0, 0) % 1000) / 1000;
            return {
                ...entry,
                series,
                nonGenericCategories,
                primaryCategory: nonGenericCategories[0] || entry.categories[0] || 'casual',
                popularityPrior,
                featureRichness,
                discoveryValue,
                tieBreaker
            };
        });

        this.catalog = Object.fromEntries(this.entries.map((entry) => [entry.key, entry]));
    }

    getActivityMinutes(activity) {
        if (typeof activity?.totalPlayTimeMs === 'number') return activity.totalPlayTimeMs / 60000;
        if (typeof activity?.playTimeHours === 'number' || typeof activity?.playTimeMinutes === 'number') return ((activity.playTimeHours || 0) * 60) + (activity.playTimeMinutes || 0);
        if (typeof activity?.playTime === 'number') return activity.playTime;
        return 0;
    }

    buildProfile(activityList) {
        const merged = {};
        (Array.isArray(activityList) ? activityList : []).forEach((activity) => {
            const key = this.normalizeKey(activity?.gameKey);
            if (!key || !this.catalog[key]) return;
            if (!merged[key]) merged[key] = { key, playCount: 0, totalMinutes: 0, lastPlayed: null, descriptor: this.catalog[key] };
            merged[key].playCount += Math.max(1, Number(activity.playCount) || 1);
            merged[key].totalMinutes += Math.max(0, this.getActivityMinutes(activity));
            if (activity.lastPlayed && (!merged[key].lastPlayed || activity.lastPlayed > merged[key].lastPlayed)) merged[key].lastPlayed = activity.lastPlayed;
        });

        const normalizedActivity = Object.values(merged).map((activity) => {
            const lastPlayedDate = activity.lastPlayed ? new Date(activity.lastPlayed) : null;
            const ageDays = lastPlayedDate && !Number.isNaN(lastPlayedDate.getTime()) ? Math.max(0, (Date.now() - lastPlayedDate.getTime()) / 86400000) : 45;
            const minutesNorm = clamp(Math.log1p(activity.totalMinutes) / Math.log1p(360), 0, 1);
            const frequencyNorm = clamp(Math.log1p(activity.playCount) / Math.log1p(12), 0, 1);
            const recencyNorm = clamp(Math.exp(-ageDays / this.options.recencyHalfLifeDays), 0, 1);
            activity.recentWeight = clamp(Math.exp(-ageDays / 8), 0, 1);
            activity.weight = (0.15 + (recencyNorm * 0.45) + (minutesNorm * 0.25) + (frequencyNorm * 0.15)) * (1 + (minutesNorm * 0.2) + (frequencyNorm * 0.15));
            activity.ageDays = ageDays;
            return activity;
        }).sort((left, right) => right.weight - left.weight);

        const recentActivity = [...normalizedActivity].sort((left, right) => left.ageDays - right.ageDays).slice(0, 4);

        const profile = {
            normalizedActivity,
            recentActivity,
            playedKeys: new Set(normalizedActivity.map((activity) => activity.key)),
            recentKeys: new Set(recentActivity.map((activity) => activity.key)),
            categoryWeights: {},
            tokenWeights: {},
            gradientWeights: {},
            typeWeights: {},
            seriesWeights: {},
            categoryMomentum: {},
            typeMomentum: {},
            seriesMomentum: {},
            seenSpecificCategories: new Set(),
            recentSeriesCounts: {},
            recentPrimaryCategoryCounts: {},
            anchors: [],
            graphScores: {},
            avgSessionMinutes: 0,
            explorationPreference: 0.3,
            noveltyPreference: 0.2,
            focusScore: 0.4,
            seriesDepthPreference: 0.32
        };

        if (!normalizedActivity.length) return profile;

        let weightedMinutes = 0;
        let totalWeight = 0;
        normalizedActivity.forEach((activity) => {
            const descriptor = activity.descriptor;
            totalWeight += activity.weight;
            const sessionMinutes = Math.max(1, activity.totalMinutes / Math.max(activity.playCount, 1));
            const momentumWeight = clamp((activity.recentWeight * 0.7) + (activity.weight * 0.3), 0, 1.5);
            weightedMinutes += sessionMinutes * activity.weight;
            descriptor.categories.forEach((category) => {
                profile.categoryWeights[category] = (profile.categoryWeights[category] || 0) + (activity.weight * (this.categoryImportance[category] || 0.1));
                if (!GENERIC_CATEGORIES.has(category)) profile.seenSpecificCategories.add(category);
            });
            descriptor.tokens.forEach((token) => {
                profile.tokenWeights[token] = (profile.tokenWeights[token] || 0) + (activity.weight * (this.tokenImportance[token] || 0.1));
            });
            profile.gradientWeights[descriptor.gradient] = (profile.gradientWeights[descriptor.gradient] || 0) + (activity.weight * 0.6);
            profile.typeWeights[descriptor.type] = (profile.typeWeights[descriptor.type] || 0) + (activity.weight * 0.8);
            if (descriptor.series) profile.seriesWeights[descriptor.series] = (profile.seriesWeights[descriptor.series] || 0) + (activity.weight * 1.1);
            (descriptor.nonGenericCategories.length ? descriptor.nonGenericCategories : [descriptor.primaryCategory]).forEach((category) => {
                profile.categoryMomentum[category] = (profile.categoryMomentum[category] || 0) + (momentumWeight * (this.categoryImportance[category] || 0.1));
            });
            profile.typeMomentum[descriptor.type] = (profile.typeMomentum[descriptor.type] || 0) + (momentumWeight * 0.85);
            if (descriptor.series) profile.seriesMomentum[descriptor.series] = (profile.seriesMomentum[descriptor.series] || 0) + (momentumWeight * 1.05);
        });

        recentActivity.forEach((activity, index) => {
            const descriptor = activity.descriptor;
            const recentBoost = clamp(1 - (index * 0.18), 0.35, 1);
            if (descriptor.series) profile.recentSeriesCounts[descriptor.series] = (profile.recentSeriesCounts[descriptor.series] || 0) + recentBoost;
            profile.recentPrimaryCategoryCounts[descriptor.primaryCategory] = (profile.recentPrimaryCategoryCounts[descriptor.primaryCategory] || 0) + recentBoost;
        });

        [profile.categoryWeights, profile.tokenWeights, profile.gradientWeights, profile.typeWeights, profile.seriesWeights, profile.categoryMomentum, profile.typeMomentum, profile.seriesMomentum].forEach((mapObject) => {
            this.normalizeWeightMap(mapObject);
        });

        profile.avgSessionMinutes = totalWeight > 0 ? (weightedMinutes / totalWeight) : 0;
        profile.anchors = normalizedActivity.slice(0, this.options.anchorCount).map((activity) => ({ descriptor: activity.descriptor, weight: clamp(activity.weight / Math.max(normalizedActivity[0]?.weight || 1, 1), 0.35, 1) }));
        const specificCategoryWeights = Object.fromEntries(Object.entries(profile.categoryWeights).filter(([category]) => !GENERIC_CATEGORIES.has(category)));
        const categoryVariety = this.calculateEntropy(specificCategoryWeights);
        const seriesVariety = this.calculateEntropy(profile.seriesWeights);
        const replayBias = clamp((normalizedActivity[0]?.weight || 0) / Math.max(totalWeight, 1), 0, 1);
        const breadthScore = clamp((Object.keys(specificCategoryWeights).length * 0.08) + (Object.keys(profile.seriesWeights).length * 0.05), 0, 1);
        profile.focusScore = clamp(((1 - categoryVariety) * 0.55) + (replayBias * 0.45), 0.15, 0.95);
        profile.explorationPreference = clamp(0.14 + (categoryVariety * 0.24) + (seriesVariety * 0.08) + (breadthScore * 0.2) + (profile.avgSessionMinutes > 24 ? 0.04 : 0) - (replayBias * 0.12), 0.12, 0.62);
        profile.noveltyPreference = clamp(0.1 + (categoryVariety * 0.22) + (breadthScore * 0.14) + (recentActivity.length > 2 ? 0.04 : 0) - (replayBias * 0.08), 0.08, 0.48);
        profile.seriesDepthPreference = clamp(0.2 + (replayBias * 0.18) + ((1 - seriesVariety) * 0.1) + (Object.keys(profile.seriesWeights).length ? 0.08 : 0), 0.18, 0.72);
        profile.graphScores = this.buildGraphScores(profile);
        return profile;
    }

    weightedListSimilarity(leftList, rightList, weightGetter) {
        const leftSet = new Set(leftList);
        const rightSet = new Set(rightList);
        const union = new Set([...leftSet, ...rightSet]);
        if (!union.size) return 0;
        let intersection = 0;
        let total = 0;
        union.forEach((item) => {
            const weight = weightGetter(item);
            if (leftSet.has(item) && rightSet.has(item)) intersection += weight;
            total += weight;
        });
        return total > 0 ? clamp(intersection / total, 0, 1) : 0;
    }

    normalizeWeightMap(mapObject) {
        const maxValue = Math.max(...Object.values(mapObject), 0);
        if (maxValue <= 0) return mapObject;
        Object.keys(mapObject).forEach((key) => { mapObject[key] = clamp(mapObject[key] / maxValue, 0, 1); });
        return mapObject;
    }

    calculateEntropy(mapObject) {
        const values = Object.values(mapObject).filter((value) => value > 0);
        if (values.length < 2) return 0;
        const total = values.reduce((sum, value) => sum + value, 0);
        if (total <= 0) return 0;
        const entropy = values.reduce((sum, value) => {
            const probability = value / total;
            return sum - (probability * Math.log(probability));
        }, 0);
        return clamp(entropy / Math.log(values.length), 0, 1);
    }

    buildFeatureRelations() {
        const relatedCounts = {};
        const totals = {};
        this.entries.forEach((entry) => {
            const categories = entry.nonGenericCategories.length ? entry.nonGenericCategories : entry.categories;
            const uniqueCategories = Array.from(new Set(categories));
            uniqueCategories.forEach((category) => { totals[category] = (totals[category] || 0) + 1; });
            uniqueCategories.forEach((left, leftIndex) => {
                uniqueCategories.slice(leftIndex + 1).forEach((right) => {
                    relatedCounts[left] ||= {};
                    relatedCounts[right] ||= {};
                    relatedCounts[left][right] = (relatedCounts[left][right] || 0) + 1;
                    relatedCounts[right][left] = (relatedCounts[right][left] || 0) + 1;
                });
            });
        });

        this.relatedCategories = {};
        Object.entries(relatedCounts).forEach(([category, matches]) => {
            this.relatedCategories[category] = {};
            Object.entries(matches).forEach(([otherCategory, count]) => {
                const base = Math.max(totals[category] || 1, totals[otherCategory] || 1);
                this.relatedCategories[category][otherCategory] = clamp((count / base) * 1.5, 0, 1);
            });
        });
    }

    getCategoryBridge(leftCategories, rightCategories) {
        let best = 0;
        leftCategories.forEach((leftCategory) => {
            rightCategories.forEach((rightCategory) => {
                if (leftCategory === rightCategory) return;
                best = Math.max(best, this.relatedCategories[leftCategory]?.[rightCategory] || 0);
            });
        });
        return clamp(best, 0, 1);
    }

    buildGraph() {
        this.graph = {};
        this.graphCentrality = {};
        this.entries.forEach((entry) => {
            const neighbors = this.entries
                .filter((other) => other.key !== entry.key)
                .map((other) => ({ key: other.key, weight: this.similarity(entry, other) }))
                .filter((edge) => edge.weight >= 0.19)
                .sort((left, right) => right.weight - left.weight)
                .slice(0, this.options.graphNeighborCount);

            this.graph[entry.key] = neighbors;
            this.graphCentrality[entry.key] = neighbors.reduce((sum, edge) => sum + edge.weight, 0);
        });

        this.normalizeWeightMap(this.graphCentrality);
    }

    propagateGraphSignal(key, signal, scores, depth, trail) {
        if (depth >= this.options.graphPasses || signal < 0.035) return;
        (this.graph[key] || []).forEach((edge, edgeIndex) => {
            if (trail.has(edge.key)) return;
            const decay = depth === 0 ? 0.76 : 0.48;
            const rankDecay = clamp(1 - (edgeIndex * 0.06), 0.35, 1);
            const propagated = signal * edge.weight * decay * rankDecay;
            if (propagated < 0.03) return;
            scores[edge.key] = (scores[edge.key] || 0) + propagated;
            const nextTrail = new Set(trail);
            nextTrail.add(edge.key);
            this.propagateGraphSignal(edge.key, propagated, scores, depth + 1, nextTrail);
        });
    }

    buildGraphScores(profile) {
        const scores = {};
        const strongestWeight = Math.max(profile.normalizedActivity[0]?.weight || 1, 1);
        profile.normalizedActivity.slice(0, this.options.anchorCount + 2).forEach((activity, index) => {
            const seedSignal = clamp(activity.weight / strongestWeight, 0.22, 1) * clamp(1 - (index * 0.08), 0.55, 1);
            this.propagateGraphSignal(activity.key, seedSignal, scores, 0, new Set([activity.key]));
        });
        profile.playedKeys.forEach((key) => { delete scores[key]; });
        return this.normalizeWeightMap(scores);
    }

    similarity(leftDescriptor, rightDescriptor) {
        const categorySimilarity = this.weightedListSimilarity(leftDescriptor.categories, rightDescriptor.categories, (category) => this.categoryImportance[category] || 0.1);
        const tokenSimilarity = this.weightedListSimilarity(leftDescriptor.tokens, rightDescriptor.tokens, (token) => this.tokenImportance[token] || 0.1);
        const categoryBridge = this.getCategoryBridge(leftDescriptor.nonGenericCategories, rightDescriptor.nonGenericCategories);
        const seriesSimilarity = leftDescriptor.series && rightDescriptor.series && leftDescriptor.series === rightDescriptor.series ? 1 : 0;
        const typeSimilarity = leftDescriptor.type === rightDescriptor.type ? 1 : 0;
        const gradientSimilarity = leftDescriptor.gradient === rightDescriptor.gradient ? 1 : 0;
        return clamp((categorySimilarity * 0.35) + (categoryBridge * 0.12) + (tokenSimilarity * 0.18) + (seriesSimilarity * 0.22) + (typeSimilarity * 0.08) + (gradientSimilarity * 0.05), 0, 1);
    }

    scoreCandidate(descriptor, profile) {
        const categoryWeightTotal = Math.max(descriptor.categories.reduce((sum, category) => sum + (this.categoryImportance[category] || 0.1), 0), 1);
        const tokenWeightTotal = Math.max(descriptor.tokens.reduce((sum, token) => sum + (this.tokenImportance[token] || 0.1), 0), 1);
        const categoryAffinity = descriptor.categories.reduce((sum, category) => sum + ((profile.categoryWeights[category] || 0) * (this.categoryImportance[category] || 0.1)), 0) / categoryWeightTotal;
        const relatedCategoryAffinity = descriptor.nonGenericCategories.reduce((sum, category) => {
            return sum + Math.max(0, ...Object.entries(profile.categoryWeights).map(([likedCategory, weight]) => {
                if (likedCategory === category) return 0;
                return (this.relatedCategories[category]?.[likedCategory] || 0) * weight;
            }));
        }, 0) / Math.max(descriptor.nonGenericCategories.length, 1);
        const exactSpecificMatch = descriptor.nonGenericCategories.length ? Math.max(...descriptor.nonGenericCategories.map((category) => profile.categoryWeights[category] || 0), 0) : 0;
        const tokenAffinity = descriptor.tokens.length ? descriptor.tokens.reduce((sum, token) => sum + ((profile.tokenWeights[token] || 0) * (this.tokenImportance[token] || 0.1)), 0) / tokenWeightTotal : 0;
        const seriesAffinity = descriptor.series ? clamp(profile.seriesWeights[descriptor.series] || 0, 0, 1) : 0;
        const typeAffinity = Object.keys(profile.typeWeights).length ? clamp(profile.typeWeights[descriptor.type] || 0, 0, 1) : (descriptor.type === 'html' ? 0.6 : 0.45);
        const gradientAffinity = clamp(profile.gradientWeights[descriptor.gradient] || 0, 0, 1);
        const graphAffinity = clamp(profile.graphScores[descriptor.key] || 0, 0, 1);
        const anchorAffinity = profile.anchors.length ? clamp(profile.anchors.map((anchor) => this.similarity(descriptor, anchor.descriptor) * anchor.weight).sort((left, right) => right - left).slice(0, 2).reduce((sum, value) => sum + value, 0) / Math.min(profile.anchors.length, 2), 0, 1) : 0;
        const categoryMomentum = Math.max(...descriptor.nonGenericCategories.map((category) => profile.categoryMomentum[category] || 0), profile.categoryMomentum[descriptor.primaryCategory] || 0, 0);
        const seriesMomentum = descriptor.series ? (profile.seriesMomentum[descriptor.series] || 0) : 0;
        const typeMomentum = profile.typeMomentum[descriptor.type] || 0;
        const momentumAffinity = clamp((categoryMomentum * 0.55) + (seriesMomentum * 0.3) + (typeMomentum * 0.15), 0, 1);
        const quickDensity = descriptor.categories.filter((category) => QUICK_PLAY_CATEGORIES.has(category)).length / Math.max(descriptor.categories.length, 1);
        const deepDensity = descriptor.categories.filter((category) => DEEP_PLAY_CATEGORIES.has(category)).length / Math.max(descriptor.categories.length, 1);
        const sessionPreference = clamp((profile.avgSessionMinutes - 18) / 28, -1, 1);
        const sessionAffinity = sessionPreference >= 0 ? clamp((deepDensity + (descriptor.series ? 0.15 : 0)) * sessionPreference, 0, 1) : clamp((quickDensity + (descriptor.type === 'flash' ? 0.1 : 0)) * Math.abs(sessionPreference), 0, 1);
        const newSpecificCategories = descriptor.nonGenericCategories.filter((category) => !profile.seenSpecificCategories.has(category));
        const freshSeries = descriptor.series && !profile.seriesWeights[descriptor.series];
        const bridgeSignal = Math.max(categoryAffinity, relatedCategoryAffinity, tokenAffinity, seriesAffinity, anchorAffinity, graphAffinity, momentumAffinity);
        const explorationBonus = (newSpecificCategories.length || freshSeries) && bridgeSignal > 0.18
            ? clamp(((bridgeSignal * 0.58) + (relatedCategoryAffinity * 0.16) + ((newSpecificCategories.reduce((sum, category) => sum + (this.categoryImportance[category] || 0.1), 0) / Math.max(newSpecificCategories.length || 1, 1)) * 0.18) + (freshSeries ? 0.08 : 0)) * profile.explorationPreference, 0, 1)
            : 0;
        const disconnectedPenalty = !descriptor.nonGenericCategories.some((category) => (profile.categoryWeights[category] || 0) > 0.24)
            && relatedCategoryAffinity < 0.14
            && seriesAffinity < 0.2
            && graphAffinity < 0.22
            ? (0.75 + (profile.focusScore * 1.35))
            : 0;
        const mismatchPenalty = bridgeSignal < 0.2 ? clamp((0.2 - bridgeSignal) * 34, 0, 5.4) : 0;
        const recentSeriesPressure = descriptor.series ? (profile.recentSeriesCounts[descriptor.series] || 0) : 0;
        const recentCategoryPressure = profile.recentPrimaryCategoryCounts[descriptor.primaryCategory] || 0;
        const saturationPenalty = clamp(
            Math.max(0, recentSeriesPressure - (profile.seriesDepthPreference > 0.48 ? 2 : 1)) * Math.max(0, 0.22 - (profile.seriesDepthPreference * 0.18))
            + Math.max(0, recentCategoryPressure - 2) * profile.noveltyPreference * 0.1,
            0,
            0.6
        );
        const freshnessBoost = descriptor.discoveryValue * profile.noveltyPreference;
        const baseScore = (categoryAffinity * 20) + (graphAffinity * 19) + (anchorAffinity * 15) + (seriesAffinity * 11) + (tokenAffinity * 9) + (relatedCategoryAffinity * 8) + (exactSpecificMatch * 6.5) + (momentumAffinity * 7) + (typeAffinity * 5) + (gradientAffinity * 3) + (sessionAffinity * 4) + (explorationBonus * 6) + (freshnessBoost * 4) + (descriptor.popularityPrior * 3) + (this.graphCentrality[descriptor.key] || 0) + (descriptor.tieBreaker * 0.25) - (saturationPenalty * 12) - (mismatchPenalty * 3.2) - (disconnectedPenalty * 5.5);

        const reasons = [];
        if (seriesAffinity > 0.55) reasons.push('from a series you keep returning to');
        if (graphAffinity > 0.58) reasons.push('strong match to your overall play pattern');
        if (momentumAffinity > 0.52) reasons.push('fits what you have been into lately');
        if (exactSpecificMatch > 0.58) reasons.push('hits one of your strongest genres directly');
        if (categoryAffinity > 0.5) reasons.push(descriptor.nonGenericCategories.length ? `matches your ${descriptor.nonGenericCategories.slice(0, 2).join(' / ')} picks` : 'lines up with your favorite genres');
        if (relatedCategoryAffinity > 0.45) reasons.push('close to genres you already like');
        if (anchorAffinity > 0.58) reasons.push('very similar to games you spend time on');
        if (descriptor.type === 'flash' && typeAffinity > 0.65) reasons.push('fits your flash-game pattern');
        if (explorationBonus > 0.18) reasons.push('adds something new without leaving your taste');
        if (!reasons.length && descriptor.popularityPrior > 0.75) reasons.push('strong all-around pick from the catalog');

        return { descriptor, baseScore, reasons: reasons.slice(0, 3), noveltySignal: explorationBonus + freshnessBoost };
    }

    rerank(candidates, count, profile) {
        const remaining = [...candidates].sort((left, right) => right.baseScore - left.baseScore);
        const selected = [];
        while (remaining.length && selected.length < count) {
            let bestIndex = 0;
            let bestScore = -Infinity;
            remaining.forEach((candidate, index) => {
                const bestAvailableBase = remaining[0]?.baseScore || candidate.baseScore;
                const maxSimilarity = selected.length ? Math.max(...selected.map((picked) => this.similarity(candidate.descriptor, picked.descriptor))) : 0;
                const sameSeriesCount = candidate.descriptor.series ? selected.filter((picked) => picked.descriptor.series === candidate.descriptor.series).length : 0;
                const samePrimaryCategoryCount = selected.filter((picked) => picked.descriptor.primaryCategory === candidate.descriptor.primaryCategory).length;
                const selectedCategories = new Set(selected.map((picked) => picked.descriptor.primaryCategory));
                const selectedSeries = new Set(selected.map((picked) => picked.descriptor.series).filter(Boolean));
                const coverageBoost = (candidate.descriptor.nonGenericCategories.some((category) => !selectedCategories.has(category) && (profile.categoryWeights[category] || 0) > 0.25) ? 1 : 0)
                    + (candidate.descriptor.series && !selectedSeries.has(candidate.descriptor.series) && (profile.seriesWeights[candidate.descriptor.series] || 0) > 0.35 ? 1 : 0)
                    + (candidate.noveltySignal > 0.15 && candidate.descriptor.nonGenericCategories.some((category) => !profile.seenSpecificCategories.has(category)) ? 0.7 : 0);
                const preferredSeriesWeight = profile.seriesWeights[candidate.descriptor.series] || 0;
                const seriesAllowance = preferredSeriesWeight > 0.72 && profile.seriesDepthPreference > 0.48 ? 2 : 1;
                const seriesOverage = Math.max(0, sameSeriesCount - seriesAllowance + 1);
                const seriesPenalty = (sameSeriesCount * Math.max(2.8, 9.5 - (preferredSeriesWeight * 5) - (profile.seriesDepthPreference * 3.6))) + (seriesOverage * (5.4 + (profile.noveltyPreference * 4)));
                const categoryPenalty = samePrimaryCategoryCount * Math.max(1.2, 3.2 - ((profile.categoryWeights[candidate.descriptor.primaryCategory] || 0) * 1.2) - (profile.focusScore * 0.8));
                const noveltyLift = candidate.noveltySignal * (1.5 + (profile.noveltyPreference * 4));
                const qualityGapPenalty = Math.max(0, (bestAvailableBase - candidate.baseScore) - 8) * Math.max(0.18, 0.42 - (profile.explorationPreference * 0.22));
                const rerankedScore = candidate.baseScore
                    - (maxSimilarity * (8 + (profile.explorationPreference * 9)))
                    - seriesPenalty
                    - categoryPenalty
                    - qualityGapPenalty
                    + (coverageBoost * 3.2)
                    + noveltyLift;
                if (rerankedScore > bestScore) {
                    bestScore = rerankedScore;
                    bestIndex = index;
                }
            });
            const [bestCandidate] = remaining.splice(bestIndex, 1);
            bestCandidate.rerankedScore = bestScore;
            selected.push(bestCandidate);
        }
        return selected;
    }

    formatRecommendations(selected) {
        const scores = selected.map((candidate) => candidate.rerankedScore ?? candidate.baseScore);
        const maxScore = Math.max(...scores, 1);
        const minScore = Math.min(...scores, 0);
        const spread = Math.max(1, maxScore - minScore);
        return selected.map((candidate, index) => {
            const normalized = clamp(((candidate.rerankedScore ?? candidate.baseScore) - minScore) / spread, 0, 1);
            const percentileBoost = clamp((selected.length - index) / Math.max(selected.length, 1), 0, 1) * 0.08;
            return {
                key: candidate.descriptor.key,
                ...candidate.descriptor.game,
                recommendationScore: Math.round(clamp(58 + ((normalized + percentileBoost) * 40), 58, 99)),
                recommendationReasons: candidate.reasons,
                recommendationContext: candidate.reasons[0] || 'Recommended for you'
            };
        });
    }

    getRecommendations(activityList, count = 6) {
        const profile = this.buildProfile(activityList);
        if (!profile.normalizedActivity.length) return this.getPopularGames(count);
        const candidates = this.entries.filter((entry) => !profile.playedKeys.has(entry.key)).map((entry) => this.scoreCandidate(entry, profile));
        if (!candidates.length) return this.getPopularGames(count);
        return this.formatRecommendations(this.rerank(candidates, count, profile));
    }

    getPopularGames(count = 6) {
        const pseudoProfile = {
            categoryWeights: {},
            seriesWeights: {},
            typeWeights: {},
            explorationPreference: 0.5,
            noveltyPreference: 0.3,
            focusScore: 0.35,
            seriesDepthPreference: 0.3,
            seenSpecificCategories: new Set(),
            recentSeriesCounts: {},
            recentPrimaryCategoryCounts: {}
        };
        const candidates = this.entries.map((entry) => ({
            descriptor: entry,
            baseScore: (entry.popularityPrior * 62) + ((this.graphCentrality[entry.key] || 0) * 16) + (entry.featureRichness * 14) + (entry.discoveryValue * 6) + (entry.tieBreaker * 0.5),
            reasons: ['popular way to get started'],
            noveltySignal: entry.discoveryValue * 0.35
        }));
        return this.rerank(candidates, count, pseudoProfile).map((candidate, index, selected) => ({
            key: candidate.descriptor.key,
            ...candidate.descriptor.game,
            recommendationScore: Math.round(clamp(72 + ((selected.length - index) / Math.max(selected.length, 1)) * 18, 70, 95)),
            recommendationReasons: candidate.reasons,
            recommendationContext: 'Popular pick'
        }));
    }

    getGamesByCategory(category, count = 10) {
        const normalizedCategory = CATEGORY_ALIASES[this.normalizeText(category)] || this.normalizeText(category);
        return this.entries.filter((entry) => entry.categories.includes(normalizedCategory)).sort((left, right) => right.popularityPrior - left.popularityPrior).slice(0, count).map((entry) => ({ key: entry.key, ...entry.game }));
    }

    getSimilarGames(gameKey, count = 5) {
        const target = this.catalog[this.normalizeKey(gameKey)];
        if (!target) return [];
        const graphNeighbors = this.graph[target.key] || [];
        if (graphNeighbors.length) {
            return graphNeighbors.slice(0, count).map((neighbor) => {
                const entry = this.catalog[neighbor.key];
                return { key: entry.key, ...entry.game, similarityScore: Math.round(neighbor.weight * 100) };
            });
        }
        return this.entries.filter((entry) => entry.key !== target.key).map((entry) => ({ entry, similarity: this.similarity(target, entry) })).sort((left, right) => right.similarity - left.similarity).slice(0, count).map((item) => ({ key: item.entry.key, ...item.entry.game, similarityScore: Math.round(item.similarity * 100) }));
    }
}

function getUserActivityFromCookie() {
    try {
        const cookieValue = getCookie('usractivity');
        if (!cookieValue) return [];
        const parsedActivity = JSON.parse(decodeURIComponent(cookieValue));
        return Array.isArray(parsedActivity) ? parsedActivity : [];
    } catch (error) {
        console.error('Error parsing user activity cookie:', error);
        return [];
    }
}

function setIntroState(title, description) {
    const introTitle = document.querySelector('.intro h2');
    const introDescription = document.querySelector('.intro p');
    if (introTitle) introTitle.textContent = title;
    if (introDescription) introDescription.textContent = description;
}

function buildGameLink(game) {
    if (!game) return '';
    const gameId = game.key || String(game.name || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[._-]+/g, ' ')
        .replace(/[^a-z0-9() ]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (game.type === 'html' || game.type === 'unity' || game.type === 'flash') {
        return `Games/game.html?id=${encodeURIComponent(gameId)}`;
    }

    if (game.type === 'buckshot') {
        return `Games/Buckshot-Roulette.html?id=${encodeURIComponent(gameId)}`;
    }

    if (game.key && !game.link) {
        return `Games/game.html?id=${encodeURIComponent(game.key)}`;
    }

    return game.link || '';
}

async function initializePage() {
    try {
        await domReady();
        const response = await fetch('games.json');
        if (!response.ok) throw new Error('Failed to fetch games data');
        gamesData = await response.json();
        Object.entries(gamesData).forEach(([key, game]) => {
            if (game && !game.key) {
                game.key = key;
            }
        });
        userActivity = getUserActivityFromCookie();
        recommender = new GameRecommendationEngine(gamesData);
        window.setTimeout(() => { generateRecommendations(); hideLoadingScreen(); setupScrollListener(); }, 900);
    } catch (error) {
        console.error('Error loading games data:', error);
        gamesData = {};
        userActivity = getUserActivityFromCookie();
        recommender = new GameRecommendationEngine(gamesData);
        window.setTimeout(() => { showNoGamesMessage(); hideLoadingScreen(); setupScrollListener(); }, 900);
    }
}

function generateRecommendations() {
    if (!recommender || Object.keys(gamesData).length === 0) {
        showNoGamesMessage();
        return;
    }
    if (!userActivity || userActivity.length === 0) {
        setIntroState('Popular Games', 'Start playing to unlock fully personalized recommendations');
        currentRecommendations = recommender.getPopularGames(DEFAULT_RECOMMENDATION_COUNT);
    } else {
        setIntroState('Recommended Games', 'Personalized picks based on your gaming activity');
        currentRecommendations = recommender.getRecommendations(userActivity, DEFAULT_RECOMMENDATION_COUNT);
    }
    if (!currentRecommendations.length) {
        showNoActivityMessage();
        return;
    }
    loadInitialGames();
}

function loadInitialGames() {
    const gamesGrid = document.getElementById('gamesGrid');
    if (gamesGrid) gamesGrid.innerHTML = '';
    const initialGames = currentRecommendations.slice(0, batchSize);
    loadedCount = initialGames.length;
    displayGames(initialGames);
    const seeMoreBtn = document.getElementById('seeMoreBtn');
    if (seeMoreBtn) {
        seeMoreBtn.textContent = 'See More Recommendations';
        seeMoreBtn.disabled = false;
    }
}

function displayGames(games) {
    const gamesGrid = document.getElementById('gamesGrid');
    if (!gamesGrid) return;
    games.forEach((game) => gamesGrid.appendChild(createGameCard(game)));
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.title = Array.isArray(game.recommendationReasons) ? game.recommendationReasons.join(' | ') : '';
    card.onclick = () => playGame(game);

    const thumb = document.createElement('div');
    thumb.className = 'game-thumb';
    thumb.style.backgroundImage = `url('/covers/${game.cover}')`;

    const status = getGameStatus(game);
    if (status) {
        const badge = createGameStatusBadge(status);
        card.classList.add('has-game-status', `game-status-card--${status.key}`);
        card.dataset.gameStatus = status.key;
        card.title = [card.title, `${status.label}: ${status.message}`].filter(Boolean).join(' | ');
        if (badge) thumb.appendChild(badge);
    }

    card.appendChild(thumb);

    const body = document.createElement('div');
    body.className = 'game-body';
    const title = document.createElement('h3');
    title.className = 'game-title';
    title.textContent = game.name;
    body.appendChild(title);

    const categories = document.createElement('div');
    categories.className = 'game-categories';
    if (game.catagory) {
        game.catagory.split(' ').filter(Boolean).forEach((category) => {
            const tag = document.createElement('span');
            tag.className = 'game-category';
            tag.textContent = category;
            categories.appendChild(tag);
        });
    }
    body.appendChild(categories);

    const score = document.createElement('div');
    score.className = 'game-score';
    score.textContent = `Match: ${game.recommendationScore}%`;
    score.title = game.recommendationContext || '';
    body.appendChild(score);

    const playButton = document.createElement('div');
    playButton.className = 'game-play-button';
    playButton.textContent = 'Play';
    body.appendChild(playButton);

    card.appendChild(body);
    return card;
}

function showNoGamesMessage() {
    const gamesGrid = document.getElementById('gamesGrid');
    if (!gamesGrid) return;
    gamesGrid.innerHTML = '';
    const message = document.createElement('div');
    message.style.textAlign = 'center';
    message.style.gridColumn = '1 / -1';
    message.style.padding = '2rem';
    message.innerHTML = '<h3>No games data loaded</h3><p>Please ensure games.json is available and properly formatted.</p>';
    gamesGrid.appendChild(message);
}

function showNoActivityMessage() {
    const gamesGrid = document.getElementById('gamesGrid');
    if (!gamesGrid) return;
    gamesGrid.innerHTML = '';
    const message = document.createElement('div');
    message.style.textAlign = 'center';
    message.style.gridColumn = '1 / -1';
    message.style.padding = '2rem';
    message.innerHTML = '<h3>No recommendations available yet</h3><p>Play a few games to build a stronger profile.</p>';
    gamesGrid.appendChild(message);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    if (!loadingScreen || !mainContent) return;
    loadingScreen.style.opacity = '0';
    window.setTimeout(() => {
        loadingScreen.style.display = 'none';
        mainContent.classList.add('visible');
    }, 400);
}

function setupScrollListener() {
    if (scrollListenerAttached) return;
    scrollListenerAttached = true;
    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (scrollPercent > 60) showSeeMoreButton();
    });
}

function showSeeMoreButton() {
    const seeMoreContainer = document.getElementById('seeMoreContainer');
    if (seeMoreContainer && loadedCount < currentRecommendations.length) seeMoreContainer.classList.add('visible');
}

function loadMoreRecommendations() {
    const seeMoreBtn = document.getElementById('seeMoreBtn');
    if (!seeMoreBtn) return;
    seeMoreBtn.disabled = true;
    seeMoreBtn.textContent = 'Loading...';
    window.setTimeout(() => {
        const nextBatch = currentRecommendations.slice(loadedCount, loadedCount + batchSize);
        displayGames(nextBatch);
        loadedCount += nextBatch.length;
        if (loadedCount >= currentRecommendations.length) {
            seeMoreBtn.textContent = 'No More Games';
            seeMoreBtn.disabled = true;
        } else {
            seeMoreBtn.textContent = 'See More Recommendations';
            seeMoreBtn.disabled = false;
        }
    }, 450);
}

function playGame(game) {
    const gameLink = buildGameLink(game);
    if (!gameLink) {
        console.error(`No link available for ${game.name}`);
        return;
    }
    if (window.parent && window.parent !== window) {
        window.parent.location.href = gameLink;
    } else {
        window.location.href = gameLink;
    }
}

initializePage();
