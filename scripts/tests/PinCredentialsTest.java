import kr.dogdive.roomorder.PinCredentials;

public class PinCredentialsTest {
    private static void check(boolean value, String label) { if (!value) throw new AssertionError(label); }
    public static void main(String[] args) throws Exception {
        String pin = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String wrong = pin.charAt(0) == '9' ? "0" + pin.substring(1) : "9" + pin.substring(1);
        String first = PinCredentials.create(pin), second = PinCredentials.create(pin);
        check(!first.equals(second), "fresh random salt");
        check(PinCredentials.matches(pin, first), "correct PIN");
        check(!PinCredentials.matches(wrong, first), "wrong PIN");
        for (String malformed : new String[]{"", "1:a:b", "2:a:b", "1:%%%:%%%", first + ":extra"}) {
            check(!PinCredentials.matches(pin, malformed), "malformed credential rejected");
        }
        for (String invalid : new String[]{"", "12345", "1234567", "12345a", "１２３４５６", "12345\n"}) {
            check(!PinCredentials.valid(invalid), "six ASCII digits required");
        }
        check(!PinCredentials.matches(null, first), "null PIN rejected");
        check(!PinCredentials.matches(pin, null), "missing credentials rejected");
        System.out.println("PASS: salted PIN, matching, rejection and malformed input checks");
    }
}
