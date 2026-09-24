package kr.dogdive.roomorder;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Versioned, salted credentials. No plaintext PIN or default credential is stored. */
public final class PinCredentials {
    private static final int ITERATIONS = 120_000;
    private PinCredentials() {}
    public static boolean valid(String pin) { return pin != null && pin.matches("[0-9]{6}"); }
    public static String create(String pin) throws GeneralSecurityException {
        if (!valid(pin)) throw new IllegalArgumentException("Invalid PIN format");
        byte[] salt = new byte[16]; new SecureRandom().nextBytes(salt);
        return "1:" + Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(derive(pin, salt));
    }
    public static boolean matches(String pin, String stored) throws GeneralSecurityException {
        if (!valid(pin) || stored == null) return false;
        try {
            String[] parts = stored.split(":");
            if (parts.length != 3 || !parts[0].equals("1")) return false;
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expected = Base64.getDecoder().decode(parts[2]);
            if (salt.length != 16 || expected.length != 32) return false;
            byte[] actual = derive(pin, salt);
            try { return MessageDigest.isEqual(expected, actual); }
            finally { Arrays.fill(actual, (byte) 0); }
        } catch (IllegalArgumentException e) { return false; }
    }
    private static byte[] derive(String pin, byte[] salt) throws GeneralSecurityException {
        char[] chars = pin.toCharArray(); PBEKeySpec spec = new PBEKeySpec(chars, salt, ITERATIONS, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        finally { spec.clearPassword(); Arrays.fill(chars, '\0'); }
    }
}
