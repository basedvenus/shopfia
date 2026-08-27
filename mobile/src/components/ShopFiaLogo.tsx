import { Image, StyleSheet, View } from "react-native";

export function ShopFiaLogo() {
  return (
    <View style={styles.row}>
      <Image
        alt="ShopFia"
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={require("../../assets/logo.png")}
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row"
  },
  logo: {
    height: 58,
    width: 149
  }
});
