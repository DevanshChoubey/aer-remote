const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-notifications adds the aps-environment (push) entitlement on iOS. A free Apple ID can't sign
 * it, and local notifications don't need it, so it is removed again.
 */
function removePushEntitlement(entitlements) {
  const { 'aps-environment': _removed, ...rest } = entitlements;
  return rest;
}

function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults = removePushEntitlement(cfg.modResults);
    return cfg;
  });
}

module.exports = withNoPushEntitlement;
module.exports.removePushEntitlement = removePushEntitlement;
