package kr.dogdive.roomorder;

public final class UpdatePolicyTest {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    public static void main(String[] args) {
        check(!UpdatePolicy.inWindow(2) && UpdatePolicy.inWindow(3) && UpdatePolicy.inWindow(4) && !UpdatePolicy.inWindow(5) && !UpdatePolicy.inWindow(15), "off-hours window 03:00-05:00");
        long h = 3_600_000L;
        check(UpdatePolicy.checkDue(10 * h, 0), "first check");
        check(!UpdatePolicy.checkDue(10 * h, 5 * h), "not again within 6 hours");
        check(UpdatePolicy.checkDue(11 * h, 5 * h), "due after 6 hours");
        check(UpdatePolicy.checkDue(4 * h, 5 * h), "clock moved backwards");
        check(UpdatePolicy.installNow(true, 3, true, false), "idle, off-hours, verified");
        check(!UpdatePolicy.installNow(false, 3, true, false), "never while someone may be ordering");
        check(!UpdatePolicy.installNow(true, 12, true, false), "never during business hours");
        check(!UpdatePolicy.installNow(true, 3, false, false), "never an unverified file");
        check(!UpdatePolicy.installNow(true, 3, true, true), "a confirmation-required install waits for an administrator");
        String repo = "owner/room-order";
        check(UpdatePolicy.manifestUrl(repo, false).equals("https://github.com/owner/room-order/releases/latest/download/update.json"), "release manifest");
        check(UpdatePolicy.manifestUrl(repo, true).endsWith("/update-dev.json"), "debug manifest");
        check(UpdatePolicy.manifestUrl("", false).isEmpty() && UpdatePolicy.manifestUrl("a/b/c", false).isEmpty() && UpdatePolicy.manifestUrl("../x", false).isEmpty(), "unset or malformed repository disables updates");
        String apk = "https://github.com/owner/room-order/releases/download/v2.6.3/dogdive-order.apk", sha = "a".repeat(64);
        check(UpdatePolicy.acceptable(repo, 20, 19, apk, sha), "newer signed release asset");
        check(UpdatePolicy.acceptable(repo, 20, 19, apk, sha.toUpperCase()), "upper-case hash");
        check(!UpdatePolicy.acceptable(repo, 19, 19, apk, sha) && !UpdatePolicy.acceptable(repo, 18, 19, apk, sha), "same or older version");
        check(!UpdatePolicy.acceptable(repo, 20, 19, "http://github.com/owner/room-order/releases/download/v2/a.apk", sha), "plain HTTP");
        check(!UpdatePolicy.acceptable(repo, 20, 19, "https://github.com/other/room-order/releases/download/v2/a.apk", sha), "another repository");
        check(!UpdatePolicy.acceptable(repo, 20, 19, "https://example.com/owner/room-order/releases/download/v2/a.apk", sha), "another host");
        check(!UpdatePolicy.acceptable(repo, 20, 19, "https://github.com/owner/room-order/releases/download/../../x.apk", sha), "path traversal");
        check(!UpdatePolicy.acceptable(repo, 20, 19, apk, "abc") && !UpdatePolicy.acceptable(repo, 20, 19, apk, null), "malformed hash");
        System.out.println("PASS: off-hours idle install, 6-hour checks, clock rollback, repository-only HTTPS assets, newer version and SHA-256 format");
    }
}
