import {
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  MASTER_REGISTRY_RESOURCE,
  UPDATE_PERMISSION,
} from "../utils/constants";

import { Reverter } from "../helpers/reverter";
import {
  MasterAccessManagement,
  ConstantsRegistry,
  MasterContractsRegistry,
  IRBAC,
  MasterContractsRegistry__factory,
} from "@ethers-v6";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("MasterContractsRegistry", async () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let USER1: SignerWithAddress;

  let constantsRegistry: ConstantsRegistry;
  let masterAccess: MasterAccessManagement;
  let registry: MasterContractsRegistry;

  const MasterContractsRegistryRole = "MCR";
  const MasterContractsRegistryCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const MasterContractsRegistryUpdate: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [UPDATE_PERMISSION],
  };
  const MasterContractsRegistryDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };
  before("setup", async () => {
    [OWNER, USER1] = await ethers.getSigners();

    const MasterContractsRegistry = await ethers.getContractFactory(
      "MasterContractsRegistry"
    );
    registry = await MasterContractsRegistry.deploy();

    const MasterAccessManagementFactory = await ethers.getContractFactory(
      "MasterAccessManagement"
    );
    masterAccess = await MasterAccessManagementFactory.deploy();
    const ConstantsRegistryFactory = await ethers.getContractFactory(
      "ConstantsRegistry"
    );
    constantsRegistry = await ConstantsRegistryFactory.deploy();

    const ReviewableRequestsFactory = await ethers.getContractFactory(
      "ReviewableRequests"
    );
    const reviewableRequests = await ReviewableRequestsFactory.deploy();

    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await ERC1967Proxy.deploy(await registry.getAddress(), "0x");
    registry = MasterContractsRegistry.attach(proxy) as MasterContractsRegistry;

    await registry.__MasterContractsRegistry_init(masterAccess);

    masterAccess = MasterAccessManagementFactory.attach(
      await registry.getMasterAccessManagement()
    ) as MasterAccessManagement;
    await masterAccess.__MasterAccessManagement_init(OWNER);

    await registry.addProxyContract(
      await registry.CONSTANTS_REGISTRY_NAME(),
      constantsRegistry
    );
    await registry.addProxyContract(
      await registry.REVIEWABLE_REQUESTS_NAME(),
      reviewableRequests
    );

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("constructor", () => {
    it("should emit Initialized event", async () => {
      const MasterContractsRegistry = await ethers.getContractFactory(
        "MasterContractsRegistry"
      );
      const _registry = await MasterContractsRegistry.deploy();
      const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const registryProxy = await ERC1967Proxy.deploy(
        await _registry.getAddress(),
        "0x"
      );

      const newRegistry = MasterContractsRegistry.attach(
        registryProxy
      ) as MasterContractsRegistry;

      const MasterAccessManagementFactory = await ethers.getContractFactory(
        "MasterAccessManagement"
      );
      const _masterAccess = await MasterAccessManagementFactory.deploy();

      let receipt = await (
        await newRegistry.__MasterContractsRegistry_init(_masterAccess)
      ).wait();
      if (receipt)
        expect(receipt.logs[3].fragment.name).to.be.equal("Initialized");
    });
  });

  describe("basic access", () => {
    it("should not initialize twice", async () => {
      const RoleManagedRegistryMock = await ethers.getContractFactory(
        "RoleManagedRegistryMock"
      );
      const roleManagedRegistryMock = await RoleManagedRegistryMock.deploy();

      await expect(
        registry.__MasterContractsRegistry_init(OWNER)
      ).to.be.rejectedWith("Initializable: contract is already initialized");

      await expect(roleManagedRegistryMock.init(OWNER)).to.be.rejectedWith(
        "Initializable: contract is not initializing"
      );
    });
  });

  describe("permissions access", () => {
    describe("injectDependencies", () => {
      it("should be possible to call injectDependencies with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .injectDependencies(await registry.CONSTANTS_REGISTRY_NAME());
      });

      it("should not be possible to call injectDependencies without Create permission", async () => {
        await expect(
          registry
            .connect(USER1)
            .injectDependencies(await registry.CONSTANTS_REGISTRY_NAME())
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("injectDependenciesWithData", () => {
      it("should be possible to call injectDependenciesWithData with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .injectDependenciesWithData(
            await registry.CONSTANTS_REGISTRY_NAME(),
            "0x"
          );
      });

      it("should not be possible to call injectDependenciesWithData without Create permission", async () => {
        await expect(
          registry
            .connect(USER1)
            .injectDependenciesWithData(
              await registry.CONSTANTS_REGISTRY_NAME(),
              "0x11"
            )
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("upgradeContract", () => {
      it("should be possible to call upgradeContract with Update permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryUpdate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .upgradeContract(
            await registry.CONSTANTS_REGISTRY_NAME(),
            constantsRegistry
          );
      });

      it("should not be possible to call upgradeContract without Update permission", async () => {
        await expect(
          registry
            .connect(USER1)
            .upgradeContract(
              await registry.CONSTANTS_REGISTRY_NAME(),
              constantsRegistry
            )
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("upgradeContractAndCall", () => {
      it("should be possible to call upgradeContractAndCall with Update permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryUpdate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .upgradeContractAndCall(
            await registry.CONSTANTS_REGISTRY_NAME(),
            constantsRegistry,
            "0x"
          );
      });

      it("should not be possible to call upgradeContractAndCall without Update permission", async () => {
        await expect(
          registry
            .connect(USER1)
            .upgradeContractAndCall(
              await registry.CONSTANTS_REGISTRY_NAME(),
              constantsRegistry,
              "0x"
            )
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("addContract", () => {
      it("should be possible to call addContract with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry.connect(USER1).addContract("TEST", constantsRegistry);
      });

      it("should not be possible to call addContract without Create permission", async () => {
        await expect(
          registry.connect(USER1).addContract("TEST", constantsRegistry)
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("addProxyContract", () => {
      it("should be possible to call addProxyContract with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .addProxyContract("TEST", constantsRegistry);
      });

      it("should not be possible to call addProxyContract without Create permission", async () => {
        await expect(
          registry.connect(USER1).addProxyContract("TEST", constantsRegistry)
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("justAddProxyContract", () => {
      it("should be possible to call justAddProxyContract with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry
          .connect(USER1)
          .justAddProxyContract("TEST", constantsRegistry);
      });

      it("should not be possible to call justAddProxyContract without Create permission", async () => {
        await expect(
          registry
            .connect(USER1)
            .justAddProxyContract("TEST", constantsRegistry)
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("removeContract", () => {
      it("should be possible to call removeContract with Delete permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryDelete],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry.justAddProxyContract("TEST", constantsRegistry);
        await registry.connect(USER1).removeContract("TEST");
      });

      it("should not be possible to call removeContract without Delete permission", async () => {
        await registry.justAddProxyContract("TEST", constantsRegistry);
        await expect(
          registry.connect(USER1).removeContract("TEST")
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });

    describe("upgrade UUPS", () => {
      const MasterContractsRegistry = MasterContractsRegistry__factory;
      let _registry: MasterContractsRegistry;

      beforeEach("setup", async () => {
        const MasterContractsRegistry = await ethers.getContractFactory(
          "MasterContractsRegistry"
        );
        _registry = await MasterContractsRegistry.deploy();
      });

      it("should be possible to upgrade UUPS proxy with Create permission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );
        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        await registry.connect(USER1).upgradeTo(_registry);
      });

      it("should not be possible to upgrade UUPS proxy without Create permission", async () => {
        await expect(
          registry.connect(USER1).upgradeTo(_registry)
        ).to.be.rejectedWith("MasterContractsRegistry: access denied");
      });
    });
  });

  describe("getters", () => {
    it("should correctly return MasterAccess contract with getMasterAccessManagement", async () => {
      expect(
        await registry.getContract(
          await registry.MASTER_ACCESS_MANAGEMENT_NAME()
        )
      ).to.be.equal(await registry.getMasterAccessManagement());
    });

    it("should correctly return ConstantsRegistry contract with getConstantsRegistry", async () => {
      expect(
        await registry.getContract(await registry.CONSTANTS_REGISTRY_NAME())
      ).to.be.equal(await registry.getConstantsRegistry());
    });

    it("should correctly return ReviewableRequests contract with getReviewableRequests", async () => {
      expect(
        await registry.getContract(await registry.REVIEWABLE_REQUESTS_NAME())
      ).to.be.equal(await registry.getReviewableRequests());
    });
  });
});
