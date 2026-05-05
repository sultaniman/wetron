import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

// happy-dom doesn't implement the Web Animations API; stub it so @base-ui/react's
// ScrollAreaViewport doesn't throw when it calls element.getAnimations().
if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}
